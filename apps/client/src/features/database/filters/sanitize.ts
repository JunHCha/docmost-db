import {
  IFilterCondition,
  ISortCondition,
} from "@/features/database/types/database.types.ts";
import { opNeedsValue } from "./operators.ts";

// Drop in-progress filter rows so they never reach the rows query. A row added
// via "Add filter" starts with no value; applying it (e.g. an empty `eq`)
// matches zero rows and blanks the grid. Empty-ops (is_empty/is_not_empty) need
// no value and are kept. `value == null` matches only undefined/null, so a
// deliberate falsy value ("" / 0 / false) is preserved.
export function sanitizeFilters(
  filters: IFilterCondition[],
): IFilterCondition[] {
  return filters.filter(
    (f) => !opNeedsValue(f.op) || f.value != null,
  );
}

// Drop sort rows with no target property; a row is only meaningful once it
// points at a column.
export function sanitizeSorts(sorts: ISortCondition[]): ISortCondition[] {
  return sorts.filter((s) => !!s.propertyId);
}
