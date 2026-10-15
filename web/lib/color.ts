export type ColorPair = {
  primary: string;
  secondary: string;
  background: string;
  text: string;
};

function channels(hex: string) {
  const normalized = hex.replace("#", "");
  return [0, 2, 4].map((index) => parseInt(normalized.slice(index, index + 2), 16));
}

function toHex(value: number) {
  return Math.round(value).toString(16).padStart(2, "0");
}

export function deriveColors(primary: string, secondary: string): ColorPair {
  const background = channels(primary)
    .map((channel) => toHex(channel * 0.06 + 255 * 0.94))
    .join("");
  return {
    primary,
    secondary,
    background: `#${background}`,
    text: "#1f1f1f",
  };
}

function luminance(hex: string) {
  const [red, green, blue] = channels(hex).map((channel) => channel / 255);
  const linear = [red, green, blue].map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastRatio(first: string, second: string) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
