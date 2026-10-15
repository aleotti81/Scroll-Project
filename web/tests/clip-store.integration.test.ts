import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { encodeClip } from "../lib/clip-store";

const fixturePath = path.join(process.cwd(), "e2e/fixtures/story.mp4");
let temporaryDirectory: string | null = null;

function probeKeyframes(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "/usr/bin/ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "frame=key_frame",
        "-of",
        "csv=p=0",
        filePath,
      ],
      { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
      (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout);
      },
    );
  });
}

afterEach(async () => {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    temporaryDirectory = null;
  }
});

describe("all-intra ffmpeg integration", () => {
  it("encodes a local fixture so every frame is a keyframe", async () => {
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "scroll-clip-integration-"));
    const outputPath = path.join(temporaryDirectory, "story-all-intra.mp4");

    await encodeClip(fixturePath, outputPath);

    const frameFlags = (await probeKeyframes(outputPath)).trim().split(/\r?\n/).filter(Boolean);
    const keyframeCount = frameFlags.filter((flag) => flag.trim() === "1").length;

    expect(frameFlags.length).toBeGreaterThan(0);
    expect(keyframeCount).toBe(frameFlags.length);
  });
});
