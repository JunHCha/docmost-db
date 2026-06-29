import { IFilterCondition } from "@/features/database/types/database.types.ts";

// A relation filter inside an embedded database view can compare against the
// embed's *host page* instead of a fixed page — "show rows related to THIS
// page". It is stored as the symbolic value { thisPage: true } and resolved to
// the host page id at render time (live), so editing the host's relations is
// reflected without re-saving the view. Unlike the abandoned template $ref
// snapshot, nothing is baked in at row creation.
export interface ThisPageRef {
  thisPage: true;
}

export function isThisPageRef(value: unknown): value is ThisPageRef {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { thisPage?: unknown }).thisPage === true
  );
}

// Replace every { thisPage } filter value with the host page id so the value
// reaches the server as a plain page id (the relation filter matches an array
// against one id). When there is no host page — e.g. the database's own page,
// not an embed — the reference cannot resolve, so the filter is dropped (the
// view shows everything) rather than sent malformed. Non-self-ref filters and
// all other fields pass through untouched.
export function resolveSelfRefFilters(
  filters: IFilterCondition[],
  hostPageId: string | undefined,
): IFilterCondition[] {
  const out: IFilterCondition[] = [];
  for (const f of filters) {
    if (isThisPageRef(f.value)) {
      if (!hostPageId) continue;
      out.push({ ...f, value: hostPageId });
    } else {
      out.push(f);
    }
  }
  return out;
}
