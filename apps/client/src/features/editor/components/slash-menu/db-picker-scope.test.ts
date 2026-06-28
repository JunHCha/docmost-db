import { describe, it, expect } from "vitest";
import {
  shouldPageEditorOpenPicker,
  shouldTemplateEditorOpenPicker,
} from "./db-picker-scope";

describe("db picker event scoping", () => {
  describe("shouldPageEditorOpenPicker", () => {
    it("opens for an event targeting this page", () => {
      expect(
        shouldPageEditorOpenPicker({ pageId: "page-1" }, "page-1"),
      ).toBe(true);
    });

    it("ignores an event targeting a different page", () => {
      expect(
        shouldPageEditorOpenPicker({ pageId: "page-2" }, "page-1"),
      ).toBe(false);
    });

    it("opens for a legacy event with no marker (backward-compat)", () => {
      expect(shouldPageEditorOpenPicker({}, "page-1")).toBe(true);
      expect(shouldPageEditorOpenPicker(undefined, "page-1")).toBe(true);
    });

    it("ignores a template-scoped event so it can't surface in a page editor", () => {
      expect(
        shouldPageEditorOpenPicker({ templateEditorId: "tpl-7" }, "page-1"),
      ).toBe(false);
    });
  });

  describe("shouldTemplateEditorOpenPicker", () => {
    it("opens only for this template editor's own marker", () => {
      expect(
        shouldTemplateEditorOpenPicker({ templateEditorId: "tpl-7" }, "tpl-7"),
      ).toBe(true);
    });

    it("ignores another template editor's marker", () => {
      expect(
        shouldTemplateEditorOpenPicker({ templateEditorId: "tpl-9" }, "tpl-7"),
      ).toBe(false);
    });

    it("ignores a page-scoped event", () => {
      expect(
        shouldTemplateEditorOpenPicker({ pageId: "page-1" }, "tpl-7"),
      ).toBe(false);
    });

    it("ignores a legacy event with no marker", () => {
      expect(shouldTemplateEditorOpenPicker({}, "tpl-7")).toBe(false);
      expect(shouldTemplateEditorOpenPicker(undefined, "tpl-7")).toBe(false);
    });
  });
});
