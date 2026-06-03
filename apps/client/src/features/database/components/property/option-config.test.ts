import { describe, it, expect } from "vitest";
import {
  getOptions,
  appendOption,
  findOptionByLabel,
  renameOption,
  recolorOption,
  removeOption,
  type SelectOption,
} from "./option-config";

const base: SelectOption[] = [
  { id: "a", label: "Todo", color: "blue" },
  { id: "b", label: "Doing", color: "green" },
];

describe("getOptions", () => {
  it("reads options out of a property config", () => {
    expect(getOptions({ options: base })).toEqual(base);
  });

  it("returns an empty array when config has no options", () => {
    expect(getOptions({})).toEqual([]);
    expect(getOptions(undefined)).toEqual([]);
  });
});

describe("appendOption", () => {
  it("returns the full existing options plus a new option with a fresh id", () => {
    const { options, newOptionId } = appendOption(base, "Done", "red");
    // full-replace echo: every existing option (with its id) is preserved
    expect(options.slice(0, 2)).toEqual(base);
    expect(options).toHaveLength(3);
    const added = options[2];
    expect(added.id).toBe(newOptionId);
    expect(typeof added.id).toBe("string");
    expect(added.id.length).toBeGreaterThan(0);
    expect(added.label).toBe("Done");
    expect(added.color).toBe("red");
  });

  it("assigns a palette color when none is given", () => {
    const { options } = appendOption(base, "Done");
    expect(typeof options[2].color).toBe("string");
    expect(options[2].color).toBeTruthy();
  });
});

describe("renameOption", () => {
  it("renames the target while preserving every other option and all ids", () => {
    const next = renameOption(base, "a", "Backlog");
    expect(next).toHaveLength(2);
    expect(next[0]).toEqual({ id: "a", label: "Backlog", color: "blue" });
    expect(next[1]).toEqual(base[1]);
  });
});

describe("recolorOption", () => {
  it("changes only the color of the target, preserving ids and labels", () => {
    const next = recolorOption(base, "b", "grape");
    expect(next[0]).toEqual(base[0]);
    expect(next[1]).toEqual({ id: "b", label: "Doing", color: "grape" });
  });
});

describe("removeOption", () => {
  it("removes the target and returns the remaining full array with ids intact", () => {
    const next = removeOption(base, "a");
    expect(next).toEqual([base[1]]);
  });
});

describe("findOptionByLabel", () => {
  it("matches trimmed and case-insensitively", () => {
    expect(findOptionByLabel(base, "  todo ")?.id).toBe("a");
    expect(findOptionByLabel(base, "DOING")?.id).toBe("b");
  });

  it("returns undefined when no label matches", () => {
    expect(findOptionByLabel(base, "Done")).toBeUndefined();
  });

  it("excludes the given id (so renaming an option to its own label is allowed)", () => {
    expect(findOptionByLabel(base, "Todo", "a")).toBeUndefined();
    // but a different option with that label is still found
    expect(findOptionByLabel(base, "Todo", "b")?.id).toBe("a");
  });
});
