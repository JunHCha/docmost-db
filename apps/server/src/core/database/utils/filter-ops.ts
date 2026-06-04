import { BadRequestException } from '@nestjs/common';
import { PropertyType } from './property-config';

// Filter operators shared by server and client. See conventions.md §3 and the
// property-type ↔ operator mapping table in issue #12.
export const FILTER_OPS = [
  'eq',
  'neq',
  'contains',
  'not_contains',
  'gt',
  'lt',
  'gte',
  'lte',
  'is_empty',
  'is_not_empty',
] as const;

export type FilterOp = (typeof FILTER_OPS)[number];

export function isFilterOp(op: string): op is FilterOp {
  return (FILTER_OPS as readonly string[]).includes(op);
}

const EMPTY_OPS: FilterOp[] = ['is_empty', 'is_not_empty'];

// Per-type operator whitelist. Keep in sync with the client `operators.ts`.
const OPS_BY_TYPE: Record<PropertyType, FilterOp[]> = {
  text: ['eq', 'neq', 'contains', 'not_contains', ...EMPTY_OPS],
  url: ['eq', 'neq', 'contains', 'not_contains', ...EMPTY_OPS],
  number: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', ...EMPTY_OPS],
  date: ['eq', 'lt', 'gt', 'lte', 'gte', ...EMPTY_OPS],
  select: ['eq', 'neq', ...EMPTY_OPS],
  multi_select: ['contains', 'not_contains', ...EMPTY_OPS],
  relation: ['contains', 'not_contains', ...EMPTY_OPS],
  checkbox: ['eq'],
};

export function allowedOpsForType(type: PropertyType): FilterOp[] {
  return OPS_BY_TYPE[type];
}

export function assertOpForType(type: PropertyType, op: string): void {
  if (!isFilterOp(op) || !OPS_BY_TYPE[type].includes(op)) {
    throw new BadRequestException(
      `Operator '${op}' is not allowed for property type '${type}'`,
    );
  }
}

// Accepts ISO 8601 dates: a bare 'YYYY-MM-DD' or a full timestamp parseable by
// Date. Returns the normalized string, or null if not a valid date.
function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) return null;
  // 'YYYY-MM-DD' (date-only) is kept verbatim; anything else normalized to ISO.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return new Date(ms).toISOString();
}

/**
 * Validate and normalize a raw filter `value` against the property type and op.
 * Unlike `validateValueForType` (property-value.ts), filter values are *raw*
 * scalars (not the tagged { type, value } object), so they need their own
 * shape checks. Throws BadRequestException on invalid input (→ 400 not 500,
 * which Postgres would otherwise raise for e.g. `::numeric` on 'abc').
 *
 * Returns the normalized value the repo should compare against. is_empty /
 * is_not_empty take no value and return undefined.
 */
export function assertFilterValueForType(
  type: PropertyType,
  op: FilterOp,
  value: unknown,
): unknown {
  // Empty-ness operators ignore any provided value.
  if (op === 'is_empty' || op === 'is_not_empty') return undefined;

  const bad = (expected: string): never => {
    throw new BadRequestException(
      `Filter value for property type '${type}' must be ${expected}`,
    );
  };

  switch (type) {
    case 'number': {
      const num =
        typeof value === 'number' ? value : Number(value as any);
      if (typeof value === 'boolean' || !Number.isFinite(num)) {
        return bad('a number');
      }
      return num;
    }
    case 'date': {
      const normalized = normalizeDate(value);
      if (normalized === null) return bad('a valid ISO 8601 date');
      return normalized;
    }
    case 'checkbox': {
      if (typeof value === 'boolean') return value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      return bad('a boolean');
    }
    case 'text':
    case 'url':
    case 'select':
    case 'multi_select':
    case 'relation': {
      // multi_select/relation filter against a single id (contains/not_contains).
      if (typeof value !== 'string') return bad('a string');
      return value;
    }
  }
}
