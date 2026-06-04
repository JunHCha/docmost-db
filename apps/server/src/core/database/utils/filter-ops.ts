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
