import { describe, expect, it } from "vitest";
import { sectionScrollVh } from "../lib/scroll-length";

describe("sectionScrollVh", () => {
  it("scales section length with video duration", () => {
    expect(sectionScrollVh(5)).toBe(300);
    expect(sectionScrollVh(10)).toBe(600);
    expect(sectionScrollVh(20)).toBe(1200);
    expect(sectionScrollVh(2)).toBe(300);
  });

  it("uses the default length for missing or invalid durations", () => {
    expect(sectionScrollVh()).toBe(300);
    expect(sectionScrollVh(0)).toBe(300);
    expect(sectionScrollVh(-1)).toBe(300);
    expect(sectionScrollVh(Number.NaN)).toBe(300);
    expect(sectionScrollVh(Number.POSITIVE_INFINITY)).toBe(300);
  });
});
