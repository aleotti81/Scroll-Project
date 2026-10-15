import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureFrames, frameSetId, getFrameSetDirectory } from "../lib/frame-store";

let temporaryDirectory: string | null = null;
let frameDirectory: string | null = null;

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile("/usr/bin/ffmpeg", args, { maxBuffer: 10 * 1024 * 1024 }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

afterEach(async () => {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    temporaryDirectory = null;
  }
  if (frameDirectory) {
    await rm(frameDirectory, { recursive: true, force: true });
    frameDirectory = null;
  }
});

describe("ensureFrames", () => {
  it("extracts a capped image sequence and writes its dimensions manifest", async () => {
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "scroll-frame-integration-"));
    const inputPath = path.join(temporaryDirectory, "test.mp4");
    await runFfmpeg([
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc=duration=2:size=320x180:rate=25",
      "-pix_fmt",
      "yuv420p",
      inputPath,
    ]);
    const id = frameSetId(await readFile(inputPath));
    frameDirectory = getFrameSetDirectory(id);

    const manifest = await ensureFrames(id, inputPath);

    expect(manifest).toEqual({ count: 60, width: 320, height: 180 });
    expect(JSON.parse(
      await readFile(path.join(frameDirectory, "manifest.json"), "utf8"),
    )).toEqual(manifest);
  });
});
