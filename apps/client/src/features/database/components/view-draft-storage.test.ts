import { describe, it, expect, beforeEach } from "vitest";
import {
  clearViewDraft,
  readViewDraft,
  viewDraftStorageKey,
  writeViewDraft,
  VIEW_DRAFT_STORAGE_VERSION,
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
    expect(readViewDraft(key)).toEqual({
      version: VIEW_DRAFT_STORAGE_VERSION,
      baseline,
      draft,
    });
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

  // A deploy can change the config shape; a draft persisted by an older build
  // must be dropped rather than restored as a false "unsaved change".
  it("drops a legacy payload without a version field", () => {
    const key = viewDraftStorageKey("db1", undefined, "v1");
    localStorage.setItem(
      key,
      JSON.stringify({ baseline: {}, draft: { sorts: [] } }),
    );
    expect(readViewDraft(key)).toBeNull();
  });

  it("drops a payload written under a different version", () => {
    const key = viewDraftStorageKey("db1", undefined, "v1");
    localStorage.setItem(
      key,
      JSON.stringify({
        version: VIEW_DRAFT_STORAGE_VERSION + 1,
        baseline: {},
        draft: { sorts: [] },
      }),
    );
    expect(readViewDraft(key)).toBeNull();
  });

  it("round-trips a payload written under the current version", () => {
    const key = viewDraftStorageKey("db1", undefined, "v1");
    const baseline = {};
    const draft = { titleWidth: 300 };
    writeViewDraft(key, baseline, draft);
    const stored = readViewDraft(key);
    expect(stored?.draft).toEqual(draft);
    expect(stored?.baseline).toEqual(baseline);
    expect(
      JSON.parse(localStorage.getItem(key) as string).version,
    ).toBe(VIEW_DRAFT_STORAGE_VERSION);
  });
});
