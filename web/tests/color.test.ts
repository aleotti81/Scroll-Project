import { describe, expect, it } from "vitest";
import { contrastRatio, deriveColors } from "../lib/color";

describe("derivazione dei colori", () => {
  it("mescola il primario con il bianco per ottenere lo sfondo e mantiene il testo scuro", () => {
    const colors = deriveColors("#758d15", "#7ad03a");
    expect(colors).toEqual({
      primary: "#758d15",
      secondary: "#7ad03a",
      background: "#f7f8f1",
      text: "#1f1f1f",
    });
  });

  it("calcola rapporti di contrasto WCAG simmetrici", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 4);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 4);
    expect(contrastRatio("#1f1f1f", "#f7f8f1")).toBeGreaterThan(4.5);
  });
});
