import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "../app/api/video-clips/[requestId]/file/route";
import { getClipFilePath } from "../lib/clip-store";

const requestId = `req-${randomUUID()}`;

function getFile(requestIdValue: string) {
  return GET(new Request(`http://localhost/api/video-clips/${requestIdValue}/file`), {
    params: Promise.resolve({ requestId: requestIdValue }),
  });
}

afterEach(async () => {
  await rm(getClipFilePath(requestId), { force: true });
});

describe("GET /api/video-clips/[requestId]/file", () => {
  it("rejects malformed request IDs", async () => {
    const response = await getFile("bad!");

    expect(response.status).toBe(400);
  });

  it("returns 404 when the encoded clip is missing", async () => {
    const response = await getFile(requestId);

    expect(response.status).toBe(404);
  });

  it("streams a stored clip as an immutable MP4", async () => {
    const outputPath = getClipFilePath(requestId);
    const clip = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, clip);

    const response = await getFile(requestId);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("content-length")).toBe(String(clip.byteLength));
    expect(response.headers.get("cache-control")).toBe(
      "private, max-age=31536000, immutable",
    );
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(clip);
  });
});
