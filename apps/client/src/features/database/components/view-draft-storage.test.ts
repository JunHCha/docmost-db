import { describe, it, expect, beforeEach } from "vitest";
import {
  clearViewDraft,
  readViewDraft,
  viewDraftStorageKey,
  writeViewDraft,
} from "./view-draft-storage";

describe("view-draft-storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("scopes the key by database, embed scope, and view", () => {
    expect(viewDraftStorageKey("db1", undefined, "v1")).toBe(
      "db-view-draft:db1:origin:v1",
    );
    expect(viewDraftStorageKey("db1", "embed1", "v1")).toBe(
      "db-view-draft:db1:embed1:v1",
    );
    // Different embed scopes never collide for the same db/view.
    expect(viewDraftStorageKey("db1", "embed1", "v1")).not.toBe(
      viewDraftStorageKey("db1", "embed2", "v1"),
    );
  });

  it("round-trips a stored draft and clears it", () => {
    const key = viewDraftStorageKey("db1", undefined, "v1");
    const baseline = { sorts: [] };
    const draft = { sorts: [{ propertyId: "p1", direction: "asc" as const }] };
    writeViewDraft(key, baseline, draft);
    expect(readViewDraft(key)).toEqual({ baseline, draft });
    clearViewDraft(key);
    expect(readViewDraft(key)).toBeNull();
  });

  it("returns null for an absent or unparsable slot", () => {
    const key = viewDraftStorageKey("db1", undefined, "missing");
    expect(readViewDraft(key)).toBeNull();
    localStorage.setItem(key, "{not json");
    expect(readViewDraft(key)).toBeNull();
    localStorage.setItem(key, JSON.stringify({ baseline: {} })); // no draft
    expect(readViewDraft(key)).toBeNull();
  });
});
