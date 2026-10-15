import { randomBytes } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "../app/api/video-frames/[id]/[frame]/route";
import { POST } from "../app/api/video-frames/route";
import { getFrameFilePath, getFrameSetDirectory } from "../lib/frame-store";

const id = randomBytes(12).toString("hex");

function getFrame(idValue: string, frameValue: string) {
  return GET(new Request(`http://localhost/api/video-frames/${idValue}/${frameValue}`), {
    params: Promise.resolve({ id: idValue, frame: frameValue }),
  });
}

afterEach(async () => {
  await rm(getFrameSetDirectory(id), { recursive: true, force: true });
});

describe("GET /api/video-frames/[id]/[frame]", () => {
  it("rejects malformed IDs and indices", async () => {
    expect((await getFrame("bad!", "1")).status).toBe(400);
    expect((await getFrame(id, "0")).status).toBe(400);
    expect((await getFrame(id, "1.5")).status).toBe(400);
  });

  it("returns 404 when the frame set is missing", async () => {
    expect((await getFrame(id, "1")).status).toBe(404);
  });

  it("rejects indices outside the manifest frame range", async () => {
    const directory = getFrameSetDirectory(id);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "manifest.json"), JSON.stringify({
      count: 1,
      width: 320,
      height: 180,
    }));

    expect((await getFrame(id, "2")).status).toBe(400);
  });

  it("streams an existing JPEG with immutable cache headers", async () => {
    const directory = getFrameSetDirectory(id);
    const frame = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "manifest.json"), JSON.stringify({
      count: 1,
      width: 320,
      height: 180,
    }));
    await writeFile(getFrameFilePath(id, 1), frame);

    const response = await getFrame(id, "1");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("content-length")).toBe(String(frame.byteLength));
    expect(response.headers.get("cache-control")).toBe("private, max-age=31536000, immutable");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(frame);
  });
});

describe("POST /api/video-frames", () => {
  it("rejects a multipart upload whose video field is not a video", async () => {
    const form = new FormData();
    form.set("video", new File(["not video"], "image.png", { type: "image/png" }));

    const response = await POST(new Request("http://localhost/api/video-frames", {
      method: "POST",
      body: form,
    }));

    expect(response.status).toBe(400);
  });
});
