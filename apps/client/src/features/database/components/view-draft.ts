import { IDatabaseViewConfig } from "@/features/database/types/database.types.ts";

// The view-config fields the toolbar/column UI can edit and that deferred-save
// persists in one batch. Equality and reseed only consider these — server-only
// or unrelated keys never make a draft look dirty.
const DRAFT_KEYS = [
  "columns",
  "titleWidth",
  "filters",
  "sorts",
  "groupByPropertyId",
  "datePropertyId",
] as const;

// Canonical JSON: object keys sorted recursively, null/undefined entries
// dropped. Postgres jsonb round-trips reorder keys and the server may echo
// null where the client wrote undefined — both must compare equal, otherwise
// a refresh shows a false "Save changes" (#draft-robustness).
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v === undefined || v === null) continue;
      out[key] = canonicalize(v);
    }
    return out;
  }
  return value;
}

// Stable string for a single top-level field. null / undefined / absent and
// the empty array all mean "not set" for every DRAFT_KEY, so they normalise
// to the same sentinel.
function normalize(value: unknown): string {
  if (value === undefined || value === null) return "∅";
  if (Array.isArray(value) && value.length === 0) return "∅";
  return JSON.stringify(canonicalize(value));
}

// A draft is dirty when any editable field differs from the saved config. Used
// to reveal the Save / Revert actions and to gate tab-switch reseed.
export function isDraftDirty(
  draft: IDatabaseViewConfig | undefined,
  saved: IDatabaseViewConfig | undefined,
): boolean {
  if (!draft || !saved) return false;
  return DRAFT_KEYS.some((k) => normalize(draft[k]) !== normalize(saved[k]));
}
