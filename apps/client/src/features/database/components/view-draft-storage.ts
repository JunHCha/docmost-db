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
  baseline: IDatabaseViewConfig;
  draft: IDatabaseViewConfig;
}

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
    localStorage.setItem(key, JSON.stringify({ baseline, draft }));
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
