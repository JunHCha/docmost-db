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

// Stable JSON for a single field: arrays/objects are compared structurally,
// undefined is normalised so { } and { x: undefined } look equal.
function normalize(value: unknown): string {
  return value === undefined ? "∅" : JSON.stringify(value);
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
