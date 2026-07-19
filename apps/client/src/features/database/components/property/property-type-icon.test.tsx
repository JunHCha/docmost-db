import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { PropertyType } from "@/features/database/types/database.types.ts";
import {
  PROPERTY_TYPE_ICONS,
  PropertyTypeIcon,
} from "./property-type-icon";

const ALL_TYPES: PropertyType[] = [
  "text",
  "number",
  "date",
  "select",
  "multi_select",
  "checkbox",
  "url",
  "relation",
];

describe("PropertyTypeIcon", () => {
  it("has an icon mapping for every property type", () => {
    for (const type of ALL_TYPES) {
      expect(PROPERTY_TYPE_ICONS[type]).toBeTruthy();
    }
  });

  it("maps each type to a distinct tabler icon class", () => {
    const classes = ALL_TYPES.map((type) => {
      const { container } = render(<PropertyTypeIcon type={type} />);
      const svg = container.querySelector("svg");
      return svg?.getAttribute("class") ?? "";
    });
    // Each rendered icon carries a tabler-icon-* class…
    classes.forEach((cls) => expect(cls).toMatch(/tabler-icon-/));
    // …and no two types share the same icon (mapping is unambiguous).
    const iconNames = classes.map(
      (cls) => cls.split(/\s+/).find((c) => c.startsWith("tabler-icon-")) ?? "",
    );
    expect(new Set(iconNames).size).toBe(ALL_TYPES.length);
  });

  it("has a distinct icon for each computed system type", () => {
    const computed: PropertyType[] = [
      "created_by",
      "created_time",
      "last_edited_time",
    ];
    for (const type of computed) {
      expect(PROPERTY_TYPE_ICONS[type]).toBeTruthy();
    }
    const iconNames = computed.map((type) => {
      const { container } = render(<PropertyTypeIcon type={type} />);
      const cls = container.querySelector("svg")?.getAttribute("class") ?? "";
      return cls.split(/\s+/).find((c) => c.startsWith("tabler-icon-")) ?? "";
    });
    expect(new Set(iconNames).size).toBe(computed.length);
  });

  it("renders the icon hidden from assistive tech (label sits beside it)", () => {
    const { container } = render(<PropertyTypeIcon type="number" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("respects the requested size", () => {
    const { container } = render(<PropertyTypeIcon type="text" size={20} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("20");
  });
});
