import type { Section } from "./schema";

export const AI_VIDEO_RATE_PER_SECOND = 0.058;

export function sectionCost(section: Section) {
  if (
    (section.type === "B" || section.type === "C") &&
    section.media.source === "photos"
  ) {
    return section.media.durationSec * AI_VIDEO_RATE_PER_SECOND;
  }
  return 0;
}

export function totalCost(sections: Section[]) {
  return sections.reduce((total, section) => total + sectionCost(section), 0);
}

export function formatCost(value: number) {
  return `$${value.toFixed(2)}`;
}
