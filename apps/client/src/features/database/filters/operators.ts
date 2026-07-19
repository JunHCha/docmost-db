import {
  FilterOp,
  PropertyType,
} from "@/features/database/types/database.types.ts";

export interface OperatorOption {
  op: FilterOp;
  label: string;
}

// Notion-like operator labels, keyed by internal op. Mirrors the server
// `filter-ops.ts` whitelist (issue #12 mapping table).
const LABELS: Record<FilterOp, string> = {
  eq: "Is",
  neq: "Is not",
  contains: "Contains",
  not_contains: "Does not contain",
  gt: "Greater than",
  lt: "Less than",
  gte: "Greater than or equal",
  lte: "Less than or equal",
  is_empty: "Is empty",
  is_not_empty: "Is not empty",
};

const EMPTY_OPS: FilterOp[] = ["is_empty", "is_not_empty"];

// Per-type operator order. Keep in sync with server OPS_BY_TYPE.
const OPS_BY_TYPE: Record<PropertyType, FilterOp[]> = {
  text: ["eq", "neq", "contains", "not_contains", ...EMPTY_OPS],
  url: ["eq", "neq", "contains", "not_contains", ...EMPTY_OPS],
  number: ["eq", "neq", "gt", "lt", "gte", "lte", ...EMPTY_OPS],
  date: ["eq", "lt", "gt", "lte", "gte", ...EMPTY_OPS],
  select: ["eq", "neq", ...EMPTY_OPS],
  multi_select: ["contains", "not_contains", ...EMPTY_OPS],
  relation: ["contains", "not_contains", ...EMPTY_OPS],
  person: ["contains", "not_contains", ...EMPTY_OPS],
  checkbox: ["eq"],
  // Computed system columns are not filterable (sort-only). See issue #128.
  created_by: [],
  created_time: [],
  last_edited_time: [],
};

export function operatorsForType(type: PropertyType): OperatorOption[] {
  return (OPS_BY_TYPE[type] ?? []).map((op) => ({ op, label: LABELS[op] }));
}

export function operatorLabel(op: FilterOp): string {
  return LABELS[op];
}

// is_empty / is_not_empty take no value; the filter widget is hidden for them.
export function opNeedsValue(op: FilterOp): boolean {
  return !EMPTY_OPS.includes(op);
}
