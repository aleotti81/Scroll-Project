import { describe, expect, it } from "vitest";
import {
  extractionFps,
  frameSetId,
  isValidFrameIndex,
  isValidFrameSetId,
} from "../lib/frame-store";

describe("frame-store helpers", () => {
  it("calculates a bounded fps and falls back for invalid durations", () => {
    expect(extractionFps(2)).toBe(30);
    expect(extractionFps(10)).toBe(30);
    expect(extractionFps(20)).toBe(15);
    expect(extractionFps(200)).toBe(1.5);
    expect(extractionFps(0)).toBe(30);
    expect(extractionFps(-1)).toBe(30);
    expect(extractionFps(Number.NaN)).toBe(30);
    expect(extractionFps(Number.POSITIVE_INFINITY)).toBe(30);
  });

  it("derives repeatable SHA-256 prefixes and validates frame IDs", () => {
    const id = frameSetId(Buffer.from("video"));

    expect(id).toMatch(/^[a-f0-9]{24}$/);
    expect(id).toBe("e575d9cf4a769a4ed99d84ac");
    expect(frameSetId(Buffer.from("video"))).toBe(id);
    expect(isValidFrameSetId(id)).toBe(true);
    expect(isValidFrameSetId("../invalid")).toBe(false);
  });

  it("accepts only integer frame indices in the manifest range", () => {
    expect(isValidFrameIndex(1, 3)).toBe(true);
    expect(isValidFrameIndex(3, 3)).toBe(true);
    expect(isValidFrameIndex(0, 3)).toBe(false);
    expect(isValidFrameIndex(4, 3)).toBe(false);
    expect(isValidFrameIndex(1.5, 3)).toBe(false);
  });
});
