// Fixed palette of Mantine named colors used for select / multi_select option
// swatches and badges. Kept small and stable so option colors render with the
// theme's color scale (e.g. `color="blue"` -> blue badge).
export const OPTION_COLORS = [
  "gray",
  "red",
  "pink",
  "grape",
  "violet",
  "blue",
  "cyan",
  "teal",
  "green",
  "orange",
] as const;

export type OptionColor = (typeof OPTION_COLORS)[number];

const DEFAULT_COLOR: OptionColor = "gray";

// Map a stored color string back onto the palette. Unknown / missing colors
// (including ids of since-removed colors) resolve to gray so a badge never
// breaks.
export function resolveOptionColor(color: string | undefined): OptionColor {
  return (OPTION_COLORS as readonly string[]).includes(color ?? "")
    ? (color as OptionColor)
    : DEFAULT_COLOR;
}

// Deterministic palette pick used to give freshly created options a non-gray
// color based on how many options already exist.
export function pickOptionColor(index: number): OptionColor {
  return OPTION_COLORS[index % OPTION_COLORS.length];
}
