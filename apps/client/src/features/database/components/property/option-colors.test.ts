import { describe, it, expect } from "vitest";
import {
  OPTION_COLORS,
  DEFAULT_OPTION_COLOR,
  resolveOptionColor,
  pickOptionColor,
} from "./option-colors";

describe("option-colors", () => {
  it("exposes the fixed Notion-style palette in order", () => {
    expect(OPTION_COLORS).toHaveLength(10);
    expect(OPTION_COLORS.map((c) => c.key)).toEqual([
      "default",
      "gray",
      "brown",
      "orange",
      "yellow",
      "green",
      "blue",
      "purple",
      "pink",
      "red",
    ]);
    expect(new Set(OPTION_COLORS.map((c) => c.key)).size).toBe(
      OPTION_COLORS.length,
    );
  });

  it("each color carries a bg, dot swatch and a label key", () => {
    for (const color of OPTION_COLORS) {
      expect(color.bg).toMatch(/^#/);
      expect(color.dot).toMatch(/^#/);
      expect(color.labelKey.length).toBeGreaterThan(0);
    }
  });

  it("default is the first palette entry", () => {
    expect(DEFAULT_OPTION_COLOR).toBe("default");
    expect(OPTION_COLORS[0].key).toBe("default");
  });

  it("resolves a known color to its full object", () => {
    expect(resolveOptionColor("blue")).toBe(
      OPTION_COLORS.find((c) => c.key === "blue"),
    );
  });

  it("resolves an unknown or missing color to the default object", () => {
    expect(resolveOptionColor(undefined)).toBe(OPTION_COLORS[0]);
    expect(resolveOptionColor("not-a-color")).toBe(OPTION_COLORS[0]);
    expect(resolveOptionColor(undefined).key).toBe("default");
  });

  it("pickOptionColor returns a non-default key cycling the palette", () => {
    expect(pickOptionColor(0)).not.toBe("default");
    expect(pickOptionColor(0)).toBe(OPTION_COLORS[1].key);
    expect(pickOptionColor(OPTION_COLORS.length - 1)).toBe(OPTION_COLORS[1].key);
    for (let i = 0; i < 30; i++) {
      expect(pickOptionColor(i)).not.toBe("default");
    }
  });
});
