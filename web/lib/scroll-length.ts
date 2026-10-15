export function sectionScrollVh(durationSec?: number): number {
  if (typeof durationSec !== "number" || !Number.isFinite(durationSec) || durationSec <= 0) {
    return 300;
  }
  return 300 * Math.max(1, durationSec / 5);
}
