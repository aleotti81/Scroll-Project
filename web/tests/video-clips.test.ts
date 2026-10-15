import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../app/api/video-clips/[requestId]/route";
import { POST } from "../app/api/video-clips/route";
import {
  DEFAULT_MOTION_PROMPT,
  FAL_VIDEO_ENDPOINT,
} from "../lib/fal-video";

const falMocks = vi.hoisted(() => ({
  config: vi.fn(),
  upload: vi.fn(),
  submit: vi.fn(),
  status: vi.fn(),
  result: vi.fn(),
}));

vi.mock("@fal-ai/client", () => ({
  fal: {
    config: falMocks.config,
    storage: { upload: falMocks.upload },
    queue: {
      submit: falMocks.submit,
      status: falMocks.status,
      result: falMocks.result,
    },
  },
}));

const TEST_CREDENTIALS = "test-fal-key-not-real";
const REQUEST_ID = "req-12345678";

function clipForm({
  startType = "image/png",
  endType = "image/jpeg",
  durationSec = "5",
  prompt,
  startSize = 1,
  endSize = 1,
}: {
  startType?: string;
  endType?: string;
  durationSec?: string;
  prompt?: string;
  startSize?: number;
  endSize?: number;
} = {}) {
  const form = new FormData();
  form.set("startImage", new File([new Uint8Array(startSize)], "start.png", { type: startType }));
  form.set("endImage", new File([new Uint8Array(endSize)], "end.jpg", { type: endType }));
  form.set("durationSec", durationSec);
  if (prompt !== undefined) form.set("prompt", prompt);
  return form;
}

function postRequest(form: FormData) {
  return new Request("http://localhost/api/video-clips", {
    method: "POST",
    body: form,
  });
}

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

beforeEach(() => {
  delete process.env.FAL_KEY;
  vi.resetAllMocks();
});

afterEach(() => {
  delete process.env.FAL_KEY;
});

describe("POST /api/video-clips", () => {
  it("returns 503 when fal.ai is not configured", async () => {
    const response = await POST(postRequest(clipForm()));

    expect(response.status).toBe(503);
    expect(await responseBody(response)).toEqual({
      error: "Generazione video non configurata.",
    });
    expect(falMocks.config).not.toHaveBeenCalled();
    expect(falMocks.upload).not.toHaveBeenCalled();
    expect(falMocks.submit).not.toHaveBeenCalled();
  });

  it.each([
    ["missing image", () => {
      const form = new FormData();
      form.set("durationSec", "5");
      return form;
    }],
    ["unsupported image type", () => clipForm({ startType: "image/gif" })],
    ["oversized image", () => clipForm({ startSize: 15 * 1024 * 1024 + 1 })],
    ["invalid duration", () => clipForm({ durationSec: "6" })],
    ["too-long prompt", () => clipForm({ prompt: "x".repeat(601) })],
  ])("rejects %s with 400", async (_label, makeForm) => {
    process.env.FAL_KEY = TEST_CREDENTIALS;

    const response = await POST(postRequest(makeForm()));

    expect(response.status).toBe(400);
    expect(await responseBody(response)).toEqual({
      error: "Dati della clip non validi.",
    });
    expect(falMocks.upload).not.toHaveBeenCalled();
    expect(falMocks.submit).not.toHaveBeenCalled();
  });

  it("uploads both frames and submits the exact Seedance input", async () => {
    process.env.FAL_KEY = TEST_CREDENTIALS;
    const form = clipForm({ durationSec: "10", prompt: "  Slow movement  " });
    falMocks.upload
      .mockResolvedValueOnce("https://storage.fal.ai/start.png")
      .mockResolvedValueOnce("https://storage.fal.ai/end.jpg");
    falMocks.submit.mockResolvedValue({ request_id: REQUEST_ID });

    const response = await POST(postRequest(form));

    expect(response.status).toBe(200);
    expect(await responseBody(response)).toEqual({ requestId: REQUEST_ID });
    expect(falMocks.config).toHaveBeenCalledWith({ credentials: TEST_CREDENTIALS });
    expect(falMocks.upload).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: "start.png", type: "image/png", size: 1 }),
    );
    expect(falMocks.upload).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ name: "end.jpg", type: "image/jpeg", size: 1 }),
    );
    expect(falMocks.submit).toHaveBeenCalledWith(FAL_VIDEO_ENDPOINT, {
      input: {
        prompt: "Slow movement",
        image_url: "https://storage.fal.ai/start.png",
        end_image_url: "https://storage.fal.ai/end.jpg",
        duration: "10",
        resolution: "1080p",
        aspect_ratio: "16:9",
        generate_audio: false,
        camera_fixed: false,
      },
    });
  });

  it("uses the default motion prompt for empty prompt input", async () => {
    process.env.FAL_KEY = TEST_CREDENTIALS;
    falMocks.upload
      .mockResolvedValueOnce("https://storage.fal.ai/start.png")
      .mockResolvedValueOnce("https://storage.fal.ai/end.jpg");
    falMocks.submit.mockResolvedValue({ request_id: REQUEST_ID });

    const response = await POST(postRequest(clipForm({ prompt: "  " })));

    expect(response.status).toBe(200);
    expect(falMocks.submit).toHaveBeenCalledWith(
      FAL_VIDEO_ENDPOINT,
      expect.objectContaining({
        input: expect.objectContaining({ prompt: DEFAULT_MOTION_PROMPT }),
      }),
    );
  });

  it("returns 502 when the fal queue rejects a request", async () => {
    process.env.FAL_KEY = TEST_CREDENTIALS;
    falMocks.upload
      .mockResolvedValueOnce("https://storage.fal.ai/start.png")
      .mockResolvedValueOnce("https://storage.fal.ai/end.jpg");
    falMocks.submit.mockRejectedValue(new Error("mocked queue failure"));

    const response = await POST(postRequest(clipForm()));

    expect(response.status).toBe(502);
    expect(await responseBody(response)).toEqual({
      error: "Il servizio video non ha accettato la richiesta.",
    });
  });
});

describe("GET /api/video-clips/[requestId]", () => {
  const getStatus = (requestId = REQUEST_ID) =>
    GET(new Request(`http://localhost/api/video-clips/${requestId}`), {
      params: Promise.resolve({ requestId }),
    });

  it("rejects malformed request IDs before contacting fal.ai", async () => {
    process.env.FAL_KEY = TEST_CREDENTIALS;

    const response = await getStatus("bad!");

    expect(response.status).toBe(400);
    expect(falMocks.status).not.toHaveBeenCalled();
  });

  it("returns 503 when fal.ai is not configured", async () => {
    const response = await getStatus();

    expect(response.status).toBe(503);
    expect(await responseBody(response)).toEqual({
      error: "Generazione video non configurata.",
    });
    expect(falMocks.status).not.toHaveBeenCalled();
  });

  it.each([
    ["IN_QUEUE", "queued"],
    ["IN_PROGRESS", "running"],
  ])("maps %s status", async (falStatus, expectedStatus) => {
    process.env.FAL_KEY = TEST_CREDENTIALS;
    falMocks.status.mockResolvedValue({ status: falStatus });

    const response = await getStatus();

    expect(response.status).toBe(200);
    expect(await responseBody(response)).toEqual({ status: expectedStatus });
    expect(falMocks.status).toHaveBeenCalledWith(FAL_VIDEO_ENDPOINT, {
      requestId: REQUEST_ID,
    });
  });

  it("returns the generated video URL after completion", async () => {
    process.env.FAL_KEY = TEST_CREDENTIALS;
    falMocks.status.mockResolvedValue({ status: "COMPLETED" });
    falMocks.result.mockResolvedValue({
      data: { video: { url: "https://storage.fal.ai/result.mp4" } },
    });

    const response = await getStatus();

    expect(response.status).toBe(200);
    expect(await responseBody(response)).toEqual({
      status: "done",
      videoUrl: "https://storage.fal.ai/result.mp4",
    });
    expect(falMocks.result).toHaveBeenCalledWith(FAL_VIDEO_ENDPOINT, {
      requestId: REQUEST_ID,
    });
  });

  it("returns an error status when generation fails", async () => {
    process.env.FAL_KEY = TEST_CREDENTIALS;
    falMocks.status.mockResolvedValue({ status: "FAILED" });

    const response = await getStatus();

    expect(response.status).toBe(200);
    expect(await responseBody(response)).toEqual({
      status: "error",
      error: "Generazione non riuscita.",
    });
    expect(falMocks.result).not.toHaveBeenCalled();
  });

  it("returns 502 if the fal status request throws", async () => {
    process.env.FAL_KEY = TEST_CREDENTIALS;
    falMocks.status.mockRejectedValue(new Error("mocked status failure"));

    const response = await getStatus();

    expect(response.status).toBe(502);
    expect(await responseBody(response)).toEqual({
      error: "Impossibile verificare la generazione.",
    });
  });
});
