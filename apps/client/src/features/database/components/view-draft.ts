import { IDatabaseViewConfig } from "@/features/database/types/database.types.ts";
import { isTitleFilterId } from "@/features/database/filters/title-filter.ts";

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
  "endDatePropertyId",
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

// Strip config refs to properties that no longer exist — a peer can delete a
// property between the edit and Save, and persisting the dead ref would break
// the rows query (or fail the save) for everyone. Run at save time against the
// live property list so the payload is always consistent with the schema. The
// Title sentinel is not a property and an empty propertyId is an in-progress
// filter row; both always survive.
export function pruneUnknownPropertyRefs(
  config: IDatabaseViewConfig,
  knownPropertyIds: ReadonlySet<string>,
): { config: IDatabaseViewConfig; dropped: boolean } {
  const knows = (id: string | undefined): boolean =>
    !id || isTitleFilterId(id) || knownPropertyIds.has(id);
  const pruned: IDatabaseViewConfig = { ...config };
  let dropped = false;
  if (config.columns?.some((c) => !knows(c.propertyId))) {
    pruned.columns = config.columns.filter((c) => knows(c.propertyId));
    dropped = true;
  }
  if (config.filters?.some((f) => !knows(f.propertyId))) {
    pruned.filters = config.filters.filter((f) => knows(f.propertyId));
    dropped = true;
  }
  if (config.sorts?.some((s) => !knows(s.propertyId))) {
    pruned.sorts = config.sorts.filter((s) => knows(s.propertyId));
    dropped = true;
  }
  if (config.groupByPropertyId && !knows(config.groupByPropertyId)) {
    pruned.groupByPropertyId = undefined;
    dropped = true;
  }
  if (config.datePropertyId && !knows(config.datePropertyId)) {
    pruned.datePropertyId = undefined;
    dropped = true;
  }
  if (config.endDatePropertyId && !knows(config.endDatePropertyId)) {
    pruned.endDatePropertyId = undefined;
    dropped = true;
  }
  return { config: pruned, dropped };
}
