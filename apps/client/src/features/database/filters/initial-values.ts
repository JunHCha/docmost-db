import {
  IDatabaseProperty,
  IFilterCondition,
  IPropertyValue,
  PropertyType,
} from "@/features/database/types/database.types.ts";

// Filter (type, op) pairs that pin a single confirmed value (or membership) and
// therefore let us pre-fill a new row so it survives the active filter. Kept in
// strict sync with the whitelist decided in issue #103 — everything else skips.
const SINGULAR_OPS: Partial<Record<PropertyType, "eq">> = {
  select: "eq",
  checkbox: "eq",
};
const UNION_OPS: Partial<Record<PropertyType, "contains">> = {
  multi_select: "contains",
  relation: "contains",
  person: "contains",
};

// Derive tagged {type,value} seeds keyed by propertyId from the active filters.
// Filter values are raw scalars; cell values are tagged — this performs that
// conversion plus the conflict (singular) / union (membership) policy. Callers
// pass already-sanitized filters but we still defensively skip null values and
// non-whitelisted op/type combinations.
export function deriveInitialValuesFromFilters(
  filters: IFilterCondition[],
  properties: IDatabaseProperty[],
): Record<string, IPropertyValue> {
  const byId = new Map(properties.map((p) => [p.id, p]));
  // Collect the raw scalar value(s) seen per property before resolving policy.
  const singular = new Map<string, { type: PropertyType; values: unknown[] }>();
  const union = new Map<string, { type: PropertyType; values: unknown[] }>();

  for (const f of filters) {
    if (f.value == null) continue;
    const prop = byId.get(f.propertyId);
    if (!prop) continue;
    if (SINGULAR_OPS[prop.type] === f.op) {
      const entry = singular.get(f.propertyId) ?? { type: prop.type, values: [] };
      entry.values.push(f.value);
      singular.set(f.propertyId, entry);
    } else if (UNION_OPS[prop.type] === f.op) {
      const entry = union.get(f.propertyId) ?? { type: prop.type, values: [] };
      entry.values.push(f.value);
      union.set(f.propertyId, entry);
    }
  }

  const result: Record<string, IPropertyValue> = {};

  for (const [propertyId, { type, values }] of singular) {
    const distinct = Array.from(new Set(values));
    // Two different pinned values are contradictory — that property can never
    // satisfy both, so skip it rather than guess.
    if (distinct.length !== 1) continue;
    result[propertyId] = { type, value: distinct[0] };
  }

  for (const [propertyId, { type, values }] of union) {
    result[propertyId] = { type, value: Array.from(new Set(values)) };
  }

  return result;
}
