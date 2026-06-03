// Notion-style fixed palette for select / multi_select option pills. Mantine
// has no "brown", so every color is defined with explicit hex values rather
// than a theme color name. `bg` fills the pill, `dot` is the swatch shown in
// the color menu; the text color is a shared dark (#37352f).
export interface OptionColor {
  key: string;
  labelKey: string;
  bg: string;
  dot: string;
}

export const OPTION_TEXT_COLOR = "#37352f";

export const OPTION_COLORS: OptionColor[] = [
  { key: "default", labelKey: "Default", bg: "#ECECEB", dot: "#DEDEDC" },
  { key: "gray", labelKey: "Gray", bg: "#E3E2E0", dot: "#9B9A97" },
  { key: "brown", labelKey: "Brown", bg: "#EEE0DA", dot: "#A27763" },
  { key: "orange", labelKey: "Orange", bg: "#FADEC9", dot: "#D9730D" },
  { key: "yellow", labelKey: "Yellow", bg: "#FDECC8", dot: "#DFAB01" },
  { key: "green", labelKey: "Green", bg: "#DBEDDB", dot: "#0F7B6C" },
  { key: "blue", labelKey: "Blue", bg: "#D3E5EF", dot: "#0B6E99" },
  { key: "purple", labelKey: "Purple", bg: "#E8DEEE", dot: "#6940A5" },
  { key: "pink", labelKey: "Pink", bg: "#F5E0E9", dot: "#AD1A72" },
  { key: "red", labelKey: "Red", bg: "#FFE2DD", dot: "#E03E3E" },
];

export const DEFAULT_OPTION_COLOR = "default";

// Map a stored color key back onto a palette entry. Unknown / missing keys
// (including ids of since-removed colors) resolve to the default entry so a
// pill never breaks.
export function resolveOptionColor(key: string | undefined): OptionColor {
  return OPTION_COLORS.find((c) => c.key === key) ?? OPTION_COLORS[0];
}

// Deterministic palette pick for freshly created options: cycles the non-default
// colors so a new option never starts as the muted "default" gray.
export function pickOptionColor(index: number): string {
  const rest = OPTION_COLORS.length - 1;
  return OPTION_COLORS[1 + (index % rest)].key;
}
