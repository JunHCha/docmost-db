import { BadRequestException } from '@nestjs/common';
import { Expression, ExpressionBuilder, SqlBool, sql } from 'kysely';
import { DB } from '@docmost/db/types/db';
import { BaseProperty } from '@docmost/db/types/entity.types';
import {
  DateFilterAnchor,
  DateFilterRange,
  DateFilterValue,
  FilterCondition,
  FilterGroup,
  FilterNode,
  FilterOperator,
  isFilterGroup,
} from '../base.types';

const MAX_FILTER_DEPTH = 8;
const MAX_FILTER_CONDITIONS = 64;

type Eb = ExpressionBuilder<DB, 'baseRows'>;

// Value families the operators act on. Computed properties
// (createdAt/lastEditedAt/lastEditedBy) read row columns instead of cells.
type ValueKind = 'text' | 'number' | 'bool' | 'date' | 'array';

function valueKindOf(property: BaseProperty): ValueKind {
  switch (property.type) {
    case 'number':
      return 'number';
    case 'checkbox':
      return 'bool';
    case 'date':
    case 'createdAt':
    case 'lastEditedAt':
      return 'date';
    case 'multiSelect':
    case 'person':
    case 'file':
    case 'page':
    case 'relation':
    case 'lastEditedBy':
      return 'array';
    case 'formula': {
      const resultType = (property.typeOptions as any)?.resultType;
      if (resultType === 'number') return 'number';
      if (resultType === 'boolean') return 'bool';
      if (resultType === 'date') return 'date';
      return 'text';
    }
    default:
      return 'text';
  }
}

const OPS_BY_KIND: Record<ValueKind, readonly FilterOperator[]> = {
  text: [
    'eq',
    'neq',
    'contains',
    'ncontains',
    'startsWith',
    'endsWith',
    'isEmpty',
    'isNotEmpty',
  ],
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'isEmpty', 'isNotEmpty'],
  bool: ['eq', 'neq'],
  date: [
    'eq',
    'neq',
    'before',
    'after',
    'onOrBefore',
    'onOrAfter',
    'isWithin',
    'isEmpty',
    'isNotEmpty',
  ],
  array: [
    'any',
    'none',
    'all',
    'contains',
    'ncontains',
    'isEmpty',
    'isNotEmpty',
  ],
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function anchorWindow(preset: DateFilterAnchor, now: Date): [Date, Date] {
  const today = startOfUtcDay(now);
  const offsets: Record<DateFilterAnchor, number> = {
    today: 0,
    tomorrow: 1,
    yesterday: -1,
    oneWeekAgo: -7,
    oneWeekFromNow: 7,
    oneMonthAgo: -30,
    oneMonthFromNow: 30,
  };
  const start = new Date(today.getTime() + offsets[preset] * DAY_MS);
  return [start, new Date(start.getTime() + DAY_MS)];
}

function rangeWindow(preset: DateFilterRange, now: Date): [Date, Date] {
  const today = startOfUtcDay(now);
  const tomorrow = new Date(today.getTime() + DAY_MS);
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  // Weeks start on Monday.
  const dow = (today.getUTCDay() + 6) % 7;
  const weekStart = new Date(today.getTime() - dow * DAY_MS);
  switch (preset) {
    case 'pastWeek':
      return [new Date(today.getTime() - 7 * DAY_MS), tomorrow];
    case 'pastMonth':
      return [new Date(today.getTime() - 30 * DAY_MS), tomorrow];
    case 'pastYear':
      return [new Date(today.getTime() - 365 * DAY_MS), tomorrow];
    case 'thisWeek':
      return [weekStart, new Date(weekStart.getTime() + 7 * DAY_MS)];
    case 'thisMonth':
      return [new Date(Date.UTC(y, m, 1)), new Date(Date.UTC(y, m + 1, 1))];
    case 'thisYear':
      return [new Date(Date.UTC(y, 0, 1)), new Date(Date.UTC(y + 1, 0, 1))];
    case 'nextWeek': {
      const start = new Date(weekStart.getTime() + 7 * DAY_MS);
      return [start, new Date(start.getTime() + 7 * DAY_MS)];
    }
    case 'nextMonth':
      return [
        new Date(Date.UTC(y, m + 1, 1)),
        new Date(Date.UTC(y, m + 2, 1)),
      ];
    case 'nextYear':
      return [
        new Date(Date.UTC(y + 1, 0, 1)),
        new Date(Date.UTC(y + 2, 0, 1)),
      ];
  }
}

export function resolveDateWindow(
  value: unknown,
  now: Date = new Date(),
): [Date, Date] {
  const v = value as DateFilterValue | string | undefined;
  if (typeof v === 'string') {
    const parsed = new Date(v);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`invalid date filter value: ${v}`);
    }
    const start = startOfUtcDay(parsed);
    return [start, new Date(start.getTime() + DAY_MS)];
  }
  if (v && typeof v === 'object' && 'mode' in v) {
    if (v.mode === 'exact') return resolveDateWindow(v.date, now);
    if (v.mode === 'relative') return anchorWindow(v.preset, now);
    if (v.mode === 'range') return rangeWindow(v.preset, now);
  }
  throw new BadRequestException('invalid date filter value');
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function asStringArray(value: unknown): string[] {
  const arr = Array.isArray(value) ? value : [value];
  const out = arr.filter((v): v is string => typeof v === 'string');
  if (out.length === 0) {
    throw new BadRequestException('array filter requires at least one value');
  }
  return out;
}

export class FilterEngine {
  constructor(private readonly properties: Map<string, BaseProperty>) {}

  build(eb: Eb, node: FilterNode): Expression<SqlBool> {
    this.assertSize(node);
    return this.buildNode(eb, node, 0);
  }

  private assertSize(node: FilterNode) {
    let count = 0;
    const walk = (n: FilterNode, depth: number) => {
      if (depth > MAX_FILTER_DEPTH) {
        throw new BadRequestException('filter too deep');
      }
      if (isFilterGroup(n)) {
        n.children.forEach((c) => walk(c, depth + 1));
      } else if (++count > MAX_FILTER_CONDITIONS) {
        throw new BadRequestException('too many filter conditions');
      }
    };
    walk(node, 0);
  }

  private buildNode(eb: Eb, node: FilterNode, depth: number): Expression<SqlBool> {
    if (isFilterGroup(node)) {
      return this.buildGroup(eb, node, depth);
    }
    return this.buildCondition(eb, node);
  }

  private buildGroup(
    eb: Eb,
    group: FilterGroup,
    depth: number,
  ): Expression<SqlBool> {
    if (group.op !== 'and' && group.op !== 'or') {
      throw new BadRequestException(`invalid filter group op: ${group.op}`);
    }
    const children = group.children.map((c) => this.buildNode(eb, c, depth + 1));
    if (children.length === 0) {
      return sql<SqlBool>`true`;
    }
    return group.op === 'and' ? eb.and(children) : eb.or(children);
  }

  private buildCondition(eb: Eb, cond: FilterCondition): Expression<SqlBool> {
    const property = this.properties.get(cond.propertyId);
    if (!property || property.deletedAt) {
      throw new BadRequestException(
        `filter references unknown property: ${cond.propertyId}`,
      );
    }
    const kind = valueKindOf(property);
    if (!OPS_BY_KIND[kind].includes(cond.op)) {
      throw new BadRequestException(
        `operator ${cond.op} not allowed for ${property.type}`,
      );
    }
    switch (kind) {
      case 'text':
        return this.textCondition(eb, property, cond);
      case 'number':
        return this.numberCondition(eb, property, cond);
      case 'bool':
        return this.boolCondition(eb, property, cond);
      case 'date':
        return this.dateCondition(eb, property, cond);
      case 'array':
        return this.arrayCondition(eb, property, cond);
    }
  }

  private textExpr(property: BaseProperty) {
    return sql<string | null>`base_cell_text(cells, ${property.id})`;
  }

  private textCondition(
    eb: Eb,
    property: BaseProperty,
    cond: FilterCondition,
  ): Expression<SqlBool> {
    const expr = this.textExpr(property);
    const empty = sql<SqlBool>`(${expr} is null or ${expr} = '')`;
    switch (cond.op) {
      case 'isEmpty':
        return empty;
      case 'isNotEmpty':
        return sql<SqlBool>`not ${empty}`;
    }
    const value = cond.value;
    if (typeof value !== 'string') {
      throw new BadRequestException(
        `filter for ${property.type} requires a string value`,
      );
    }
    switch (cond.op) {
      case 'eq':
        return sql<SqlBool>`${expr} = ${value}`;
      case 'neq':
        return sql<SqlBool>`${expr} is distinct from ${value}`;
      case 'contains':
        return sql<SqlBool>`${expr} ilike ${'%' + escapeLike(value) + '%'}`;
      case 'ncontains':
        return sql<SqlBool>`(${expr} is null or ${expr} not ilike ${
          '%' + escapeLike(value) + '%'
        })`;
      case 'startsWith':
        return sql<SqlBool>`${expr} ilike ${escapeLike(value) + '%'}`;
      case 'endsWith':
        return sql<SqlBool>`${expr} ilike ${'%' + escapeLike(value)}`;
      default:
        throw new BadRequestException(`unsupported text op: ${cond.op}`);
    }
  }

  private numberCondition(
    eb: Eb,
    property: BaseProperty,
    cond: FilterCondition,
  ): Expression<SqlBool> {
    const expr = sql<number | null>`base_cell_numeric(cells, ${property.id})`;
    switch (cond.op) {
      case 'isEmpty':
        return sql<SqlBool>`${expr} is null`;
      case 'isNotEmpty':
        return sql<SqlBool>`${expr} is not null`;
    }
    const value = Number(cond.value);
    if (!Number.isFinite(value)) {
      throw new BadRequestException('number filter requires a numeric value');
    }
    switch (cond.op) {
      case 'eq':
        return sql<SqlBool>`${expr} = ${value}`;
      case 'neq':
        return sql<SqlBool>`${expr} is distinct from ${value}`;
      case 'gt':
        return sql<SqlBool>`${expr} > ${value}`;
      case 'gte':
        return sql<SqlBool>`${expr} >= ${value}`;
      case 'lt':
        return sql<SqlBool>`${expr} < ${value}`;
      case 'lte':
        return sql<SqlBool>`${expr} <= ${value}`;
      default:
        throw new BadRequestException(`unsupported number op: ${cond.op}`);
    }
  }

  private boolCondition(
    eb: Eb,
    property: BaseProperty,
    cond: FilterCondition,
  ): Expression<SqlBool> {
    const expr = sql<boolean>`coalesce(base_cell_bool(cells, ${property.id}), false)`;
    const value = cond.value === true || cond.value === 'true';
    return cond.op === 'eq'
      ? sql<SqlBool>`${expr} = ${value}`
      : sql<SqlBool>`${expr} <> ${value}`;
  }

  private dateExpr(property: BaseProperty) {
    if (property.type === 'createdAt') {
      return sql<Date | null>`base_rows.created_at`;
    }
    if (property.type === 'lastEditedAt') {
      return sql<Date | null>`base_rows.updated_at`;
    }
    return sql<Date | null>`base_cell_timestamptz(cells, ${property.id})`;
  }

  private dateCondition(
    eb: Eb,
    property: BaseProperty,
    cond: FilterCondition,
  ): Expression<SqlBool> {
    const expr = this.dateExpr(property);
    switch (cond.op) {
      case 'isEmpty':
        return sql<SqlBool>`${expr} is null`;
      case 'isNotEmpty':
        return sql<SqlBool>`${expr} is not null`;
    }
    const [start, end] = resolveDateWindow(cond.value);
    switch (cond.op) {
      case 'eq':
      case 'isWithin':
        return sql<SqlBool>`(${expr} >= ${start} and ${expr} < ${end})`;
      case 'neq':
        return sql<SqlBool>`(${expr} is null or ${expr} < ${start} or ${expr} >= ${end})`;
      case 'before':
        return sql<SqlBool>`${expr} < ${start}`;
      case 'after':
        return sql<SqlBool>`${expr} >= ${end}`;
      case 'onOrBefore':
        return sql<SqlBool>`${expr} < ${end}`;
      case 'onOrAfter':
        return sql<SqlBool>`${expr} >= ${start}`;
      default:
        throw new BadRequestException(`unsupported date op: ${cond.op}`);
    }
  }

  // Normalizes scalar cells to single-element arrays so single-person
  // cells and array cells filter uniformly.
  private arrayExpr(property: BaseProperty) {
    if (property.type === 'lastEditedBy') {
      return sql`(case when base_rows.last_updated_by_id is null then '[]'::jsonb
        else jsonb_build_array(base_rows.last_updated_by_id::text) end)`;
    }
    return sql`(case
      when cells -> ${property.id} is null then '[]'::jsonb
      when jsonb_typeof(cells -> ${property.id}) = 'array' then cells -> ${property.id}
      else jsonb_build_array(cells -> ${property.id})
    end)`;
  }

  private arrayCondition(
    eb: Eb,
    property: BaseProperty,
    cond: FilterCondition,
  ): Expression<SqlBool> {
    const expr = this.arrayExpr(property);
    const empty = sql<SqlBool>`${expr} = '[]'::jsonb`;
    switch (cond.op) {
      case 'isEmpty':
        return empty;
      case 'isNotEmpty':
        return sql<SqlBool>`not ${empty}`;
    }
    const values = asStringArray(cond.value);
    const pgArray = sql`array[${sql.join(values.map((v) => sql`${v}`))}]::text[]`;
    switch (cond.op) {
      case 'any':
      case 'contains':
        return sql<SqlBool>`${expr} ?| ${pgArray}`;
      case 'all':
        return sql<SqlBool>`${expr} ?& ${pgArray}`;
      case 'none':
      case 'ncontains':
        return sql<SqlBool>`not (${expr} ?| ${pgArray})`;
      default:
        throw new BadRequestException(`unsupported array op: ${cond.op}`);
    }
  }
}

// Sort expression for ORDER BY. Returns null for unsortable properties.
export function sortExpression(property: BaseProperty) {
  switch (valueKindOf(property)) {
    case 'number':
      return sql`base_cell_numeric(cells, ${property.id})`;
    case 'date':
      return property.type === 'createdAt'
        ? sql`base_rows.created_at`
        : property.type === 'lastEditedAt'
          ? sql`base_rows.updated_at`
          : sql`base_cell_timestamptz(cells, ${property.id})`;
    case 'bool':
      return sql`coalesce(base_cell_bool(cells, ${property.id}), false)`;
    case 'array':
      return sql`base_cell_array(cells, ${property.id}) ->> 0`;
    default:
      return sql`base_cell_text(cells, ${property.id})`;
  }
}
