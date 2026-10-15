import { describe, expect, it } from "vitest";
import { formatCost, sectionCost, totalCost } from "../lib/cost";
import type { Section } from "../lib/schema";

const file = {
  id: "frame",
  name: "frame.jpg",
  type: "image/jpeg",
  size: 1024,
};

describe("stima indicativa dei costi AI", () => {
  it("stima $0.29 per una clip di cinque secondi e $0.58 per dieci", () => {
    const clip5: Section = {
      id: "b",
      type: "B",
      media: { source: "photos", startPhoto: file, endPhoto: file, linkPrevious: false, durationSec: 5 },
      endText: { mode: "manual", title: "Arrivo" },
    };
    const clip10: Section = {
      id: "c",
      type: "C",
      media: { source: "photos", startPhoto: file, endPhoto: file, linkPrevious: false, durationSec: 10 },
      sideText: { mode: "manual", title: "Panorama" },
    };
    expect(sectionCost(clip5)).toBeCloseTo(0.29, 8);
    expect(sectionCost(clip10)).toBeCloseTo(0.58, 8);
    expect(formatCost(sectionCost(clip5))).toBe("$0.29");
    expect(formatCost(totalCost([clip5, clip10]))).toBe("$0.87");
  });

  it("non conteggia le sezioni A o i video già caricati", () => {
    const a: Section = {
      id: "a",
      type: "A",
      photo: file,
      text1: { mode: "manual", title: "Inizio" },
      text2: { mode: "manual", title: "Fine" },
    };
    const videoSection: Section = {
      id: "b",
      type: "B",
      media: { source: "video", video: { ...file, name: "story.mp4", type: "video/mp4" } },
      endText: { mode: "manual", title: "Fine" },
    };
    expect(sectionCost(a)).toBe(0);
    expect(sectionCost(videoSection)).toBe(0);
    expect(totalCost([a, videoSection])).toBe(0);
  });
});
