import { describe, it, expect, vi } from "vitest";
import getSuggestionItems from "./menu-items";

function flatten(groups: ReturnType<typeof getSuggestionItems>) {
  return Object.values(groups).flat();
}

describe("getSuggestionItems database view item", () => {
  it("returns the linked database view item for 'database' query", () => {
    const items = flatten(getSuggestionItems({ query: "database" }));
    expect(items.some((i) => i.title === "Database view (linked)")).toBe(true);
  });

  it("matches the 'db' search term", () => {
    const items = flatten(getSuggestionItems({ query: "db" }));
    expect(items.some((i) => i.title === "Database view (linked)")).toBe(true);
  });

  it("matches the 'linked' search term", () => {
    const items = flatten(getSuggestionItems({ query: "linked" }));
    expect(items.some((i) => i.title === "Database view (linked)")).toBe(true);
  });

  it("command deletes the slash range and dispatches a page-scoped open-picker event", () => {
    const items = flatten(getSuggestionItems({ query: "database" }));
    const item = items.find((i) => i.title === "Database view (linked)")!;

    const run = vi.fn();
    const deleteRange = vi.fn(() => ({ run }));
    const focus = vi.fn(() => ({ deleteRange }));
    const chain = vi.fn(() => ({ focus }));
    // editor.storage.pageId scopes the event so only the dispatching page's
    // editor opens the picker (not other mounted editors).
    const editor = { chain, storage: { pageId: "page-1" } } as any;

    const dispatched: CustomEvent[] = [];
    const listener = (e: Event) => dispatched.push(e as CustomEvent);
    document.addEventListener("openDatabasePickerFromEditor", listener);

    item.command({ editor, range: { from: 1, to: 5 } } as any);

    document.removeEventListener("openDatabasePickerFromEditor", listener);

    expect(deleteRange).toHaveBeenCalledWith({ from: 1, to: 5 });
    expect(run).toHaveBeenCalled();
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].detail).toEqual({ pageId: "page-1" });
  });
});
