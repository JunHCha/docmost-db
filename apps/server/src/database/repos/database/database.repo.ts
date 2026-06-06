import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import {
  Database,
  InsertableDatabase,
  UpdatableDatabase,
} from '@docmost/db/types/entity.types';
import { dbOrTx } from '@docmost/db/utils';
import { PropertyType } from '../../../core/database/utils/property-config';
import { FilterOp } from '../../../core/database/utils/filter-ops';

// A database row enriched with its page's title/icon, for listing.
export type DatabaseListItem = Database & {
  title: string | null;
  icon: string | null;
};

// Filter/sort options for listRows. The service resolves each property's type
// so the repo can pick the right jsonb casting/comparison.
export interface RowFilter {
  propertyId: string;
  propertyType: PropertyType;
  op: FilterOp;
  value?: any;
}

export interface RowSort {
  propertyId: string;
  propertyType: PropertyType;
  direction: 'asc' | 'desc';
}

export interface ListRowsOptions {
  filters?: RowFilter[];
  sorts?: RowSort[];
}

@Injectable()
export class DatabaseRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    databaseId: string,
    trx?: KyselyTransaction,
  ): Promise<Database | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('databases')
      .selectAll()
      .where('id', '=', databaseId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async findByPageId(
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<Database | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('databases')
      .selectAll()
      .where('pageId', '=', pageId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  // Databases in a space, joined with their page for title/icon (for listing).
  async findBySpaceId(
    spaceId: string,
    trx?: KyselyTransaction,
  ): Promise<DatabaseListItem[]> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('databases as d')
      .innerJoin('pages as p', 'p.id', 'd.pageId')
      .where('d.spaceId', '=', spaceId)
      .where('d.deletedAt', 'is', null)
      .where('p.deletedAt', 'is', null)
      .select([
        'd.id',
        'd.pageId',
        'd.spaceId',
        'd.workspaceId',
        'd.createdAt',
        'd.updatedAt',
        'd.deletedAt',
        'p.title',
        'p.icon',
      ])
      .orderBy('d.createdAt', 'asc')
      .execute();
  }

  async insertDatabase(
    insertable: InsertableDatabase,
    trx?: KyselyTransaction,
  ): Promise<Database> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('databases')
      .values(insertable)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async updateDatabase(
    updatable: UpdatableDatabase,
    databaseId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('databases')
      .set({ ...updatable, updatedAt: new Date() })
      .where('id', '=', databaseId)
      .execute();
  }

  // Rows of a database = the direct child pages of its database page
  // (page=row philosophy). Filters trashed rows. Optional filters/sorts are
  // applied server-side against database_property_values (jsonb). Ordered by
  // sorts (if any) with a stable pages.position ASC tie-breaker.
  async listRows(
    databasePageId: string,
    options: ListRowsOptions = {},
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    let query = db
      .selectFrom('pages')
      .select([
        'pages.id',
        'pages.slugId',
        'pages.title',
        'pages.icon',
        'pages.position',
        'pages.parentPageId',
        'pages.spaceId',
        'pages.workspaceId',
        'pages.createdAt',
        'pages.updatedAt',
      ])
      .where('pages.parentPageId', '=', databasePageId)
      .where('pages.deletedAt', 'is', null);

    for (const filter of options.filters ?? []) {
      query = query.where(() => this.buildFilter(filter)) as typeof query;
    }

    if (options.sorts && options.sorts.length > 0) {
      for (const sort of options.sorts) {
        query = query.orderBy(
          this.sortExpression(sort),
          sql.raw(`${sort.direction === 'desc' ? 'desc' : 'asc'} nulls last`),
        ) as typeof query;
      }
    }

    // Stable tie-breaker (and default order when no sorts given).
    query = query.orderBy('pages.position', 'asc') as typeof query;

    return query.execute();
  }

  // A correlated subquery against this page's value for the filter's property,
  // returning the jsonb `value` field (the inner ->'value'). NULL when no row.
  private valueSubquery(propertyId: string) {
    return sql`(select pv.value->'value' from database_property_values pv where pv.page_id = pages.id and pv.property_id = ${propertyId})`;
  }

  private buildFilter(filter: RowFilter) {
    const v = this.valueSubquery(filter.propertyId);
    const { op, propertyType, value } = filter;

    if (op === 'is_empty') {
      return sql<boolean>`(${v} is null or ${v} = '""'::jsonb or ${v} = '[]'::jsonb or ${v} = 'null'::jsonb)`;
    }
    if (op === 'is_not_empty') {
      return sql<boolean>`(${v} is not null and ${v} <> '""'::jsonb and ${v} <> '[]'::jsonb and ${v} <> 'null'::jsonb)`;
    }

    // multi_select / relation arrays: jsonb containment.
    if (propertyType === 'multi_select' || propertyType === 'relation') {
      const contains = sql<boolean>`(${v} @> ${sql.lit(JSON.stringify(value))}::jsonb)`;
      // not_contains intentionally matches rows with no value too (`${v} is
      // null`): under conventions.md §1 ("empty value = no value row"), a row
      // that lacks this property does *not* contain the id, so "does not
      // contain X" includes it. This mirrors neq below.
      return op === 'not_contains'
        ? sql<boolean>`(${v} is null or not ${contains})`
        : contains;
    }

    if (propertyType === 'checkbox') {
      // eq against a boolean.
      return sql<boolean>`((${v})::text::boolean = ${Boolean(value)})`;
    }

    if (propertyType === 'number') {
      const num = sql`(${v})::text::numeric`;
      switch (op) {
        case 'eq':
          return sql<boolean>`(${num} = ${value})`;
        case 'neq':
          // `is distinct from` intentionally treats a NULL (valueless) row as
          // "not equal", so "is not X" includes rows with no value. See the
          // not_contains note above and conventions.md §1.
          return sql<boolean>`(${num} is distinct from ${value})`;
        case 'gt':
          return sql<boolean>`(${num} > ${value})`;
        case 'lt':
          return sql<boolean>`(${num} < ${value})`;
        case 'gte':
          return sql<boolean>`(${num} >= ${value})`;
        case 'lte':
          return sql<boolean>`(${num} <= ${value})`;
      }
    }

    // text / url / date / select: compare the textual value.
    const txt = sql`(${v}#>>'{}')`;
    const str = String(value ?? '');
    switch (op) {
      case 'eq':
        return sql<boolean>`(${txt} = ${str})`;
      case 'neq':
        // Intentionally includes valueless rows (NULL is distinct from str):
        // "is not X" matches rows with no value. See conventions.md §1.
        return sql<boolean>`(${txt} is distinct from ${str})`;
      case 'contains':
        return sql<boolean>`(${txt} ilike ${'%' + str + '%'})`;
      case 'not_contains':
        return sql<boolean>`(${txt} is null or ${txt} not ilike ${'%' + str + '%'})`;
      case 'gt':
        return sql<boolean>`(${txt} > ${str})`;
      case 'lt':
        return sql<boolean>`(${txt} < ${str})`;
      case 'gte':
        return sql<boolean>`(${txt} >= ${str})`;
      case 'lte':
        return sql<boolean>`(${txt} <= ${str})`;
      default:
        return sql<boolean>`(${txt} = ${str})`;
    }
  }

  private sortExpression(sort: RowSort) {
    const v = this.valueSubquery(sort.propertyId);
    if (sort.propertyType === 'number') {
      return sql`(${v})::text::numeric`;
    }
    return sql`(${v}#>>'{}')`;
  }
}
