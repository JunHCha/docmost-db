import { describe, it, expect } from "vitest";
import {
  OPTION_COLORS,
  resolveOptionColor,
  pickOptionColor,
} from "./option-colors";

describe("option-colors", () => {
  it("exposes a non-empty fixed palette of Mantine named colors", () => {
    expect(OPTION_COLORS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(OPTION_COLORS).size).toBe(OPTION_COLORS.length);
    expect(OPTION_COLORS).toContain("blue");
  });

  it("resolves a known color to itself", () => {
    expect(resolveOptionColor("blue")).toBe("blue");
  });

  it("resolves an unknown or missing color to the default gray", () => {
    expect(resolveOptionColor(undefined)).toBe("gray");
    expect(resolveOptionColor("not-a-color")).toBe("gray");
  });

  it("pickOptionColor cycles deterministically through the palette", () => {
    expect(pickOptionColor(0)).toBe(OPTION_COLORS[0]);
    expect(pickOptionColor(OPTION_COLORS.length)).toBe(OPTION_COLORS[0]);
    expect(pickOptionColor(1)).toBe(OPTION_COLORS[1]);
  });
});
