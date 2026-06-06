import {
  IDatabaseProperty,
  IDatabaseRow,
} from "@/features/database/types/database.types.ts";
import {
  getOptions,
  SelectOption,
} from "@/features/database/components/property/option-config.ts";

export interface BoardGroup {
  option: SelectOption;
  rows: IDatabaseRow[];
}

export interface BoardBuckets {
  groups: BoardGroup[];
  // Rows with no value, an empty multi_select, or an id that no longer maps to
  // an option — they land in the trailing "No <property>" column.
  unassigned: IDatabaseRow[];
}

// Pure grouping for the board view. Columns follow the property's option order
// (no separate position), and empty option columns are kept as drop targets.
// select: one option id per row. multi_select: a row appears in every column
// whose option id is in its value array (Notion-style duplication).
export function groupRows(
  rows: IDatabaseRow[],
  property: IDatabaseProperty,
): BoardBuckets {
  const options = getOptions(property.config);
  const groups: BoardGroup[] = options.map((option) => ({ option, rows: [] }));
  const byId = new Map(groups.map((g) => [g.option.id, g]));
  const unassigned: IDatabaseRow[] = [];

  for (const row of rows) {
    const value = row.values.find((v) => v.propertyId === property.id)?.value;
    const ids = selectedIds(property.type, value?.value);
    const matched = ids.filter((id) => byId.has(id));
    if (matched.length === 0) {
      unassigned.push(row);
      continue;
    }
    for (const id of matched) {
      byId.get(id)!.rows.push(row);
    }
  }

  return { groups, unassigned };
}

function selectedIds(type: string, raw: unknown): string[] {
  if (type === "multi_select") {
    return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
  }
  return typeof raw === "string" && raw.length > 0 ? [raw] : [];
}
