import { IDatabaseViewConfig } from "@/features/database/types/database.types.ts";

// Persisted unsaved view-config draft (#92 follow-up). Deferred-save keeps edits
// in React state, so navigating away and back lost them. We mirror the dirty
// draft to localStorage keyed per view scope and restore it on return.
//
// `baseline` is the saved config the draft diverged from. On restore we compare
// it to the CURRENT saved config: if the server copy moved underneath (someone
// else edited, or a save on another device), the stored draft is stale and the
// caller drops it — server-latest wins, so an old edit never clobbers it.
export interface StoredViewDraft {
  version: number;
  baseline: IDatabaseViewConfig;
  draft: IDatabaseViewConfig;
}

// Bump whenever the persisted config shape changes across a deploy. A stored
// draft from another version is dropped on read instead of restored, so an
// old build's draft can never surface as a false "unsaved change".
export const VIEW_DRAFT_STORAGE_VERSION = 2;

// One slot per (database, embed scope, view). The embed scope segment keeps an
// inline embed's draft distinct from the original database's (issue #39 scope).
export function viewDraftStorageKey(
  databaseId: string,
  embedId: string | undefined,
  viewId: string,
): string {
  return `db-view-draft:${databaseId}:${embedId ?? "origin"}:${viewId}`;
}

// Read the stored draft, or null when absent / unparsable. localStorage access
// can throw (private mode, disabled storage); we swallow it and act as if empty.
export function readViewDraft(key: string): StoredViewDraft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredViewDraft;
    if (!parsed || typeof parsed !== "object" || !parsed.draft) return null;
    if (parsed.version !== VIEW_DRAFT_STORAGE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeViewDraft(
  key: string,
  baseline: IDatabaseViewConfig,
  draft: IDatabaseViewConfig,
): void {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ version: VIEW_DRAFT_STORAGE_VERSION, baseline, draft }),
    );
  } catch {
    // Best-effort: a full/disabled store just means no cross-navigation restore.
  }
}

export function clearViewDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
