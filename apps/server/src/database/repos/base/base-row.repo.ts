import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  BaseProperty,
  BaseRow,
  InsertableBaseRow,
} from '@docmost/db/types/entity.types';
import {
  FilterEngine,
  sortExpression,
} from '../../../core/base/engine/filter-engine';
import { FilterNode, ViewSortConfig } from '../../../core/base/base.types';

export type ListRowsResult = {
  items: BaseRow[];
  meta: {
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    nextCursor: string | null;
    prevCursor: string | null;
  };
};

// The cursor is an opaque offset token. Offset pagination can skip or
// repeat a row when rows are inserted concurrently mid-scroll; acceptable
// for now and invisible to the client contract (cursor is opaque).
function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset })).toString('base64url');
}

function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    const offset = Number(parsed?.o);
    return Number.isInteger(offset) && offset >= 0 ? offset : 0;
  } catch {
    return 0;
  }
}

@Injectable()
export class BaseRowRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    rowId: string,
    trx?: KyselyTransaction,
  ): Promise<BaseRow | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('baseRows')
      .selectAll()
      .where('id', '=', rowId)
      .executeTakeFirst();
  }

  async findLiveByIds(
    pageId: string,
    rowIds: string[],
    trx?: KyselyTransaction,
  ): Promise<BaseRow[]> {
    if (rowIds.length === 0) return [];
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('baseRows')
      .selectAll()
      .where('pageId', '=', pageId)
      .where('id', 'in', rowIds)
      .where('deletedAt', 'is', null)
      .execute();
  }

  async listRows(
    pageId: string,
    opts: {
      limit: number;
      cursor?: string;
      filter?: FilterNode;
      sorts?: ViewSortConfig[];
      properties: Map<string, BaseProperty>;
    },
  ): Promise<ListRowsResult> {
    const offset = decodeCursor(opts.cursor);
    const limit = Math.min(Math.max(opts.limit, 1), 500);

    let query = this.db
      .selectFrom('baseRows')
      .selectAll()
      .where('pageId', '=', pageId)
      .where('deletedAt', 'is', null);

    if (opts.filter) {
      const engine = new FilterEngine(opts.properties);
      query = query.where((eb) => engine.build(eb as any, opts.filter));
    }

    if (opts.sorts?.length) {
      for (const sortConfig of opts.sorts) {
        const property = opts.properties.get(sortConfig.propertyId);
        if (!property) continue;
        const direction = sortConfig.direction === 'desc' ? 'desc' : 'asc';
        const expr = sortExpression(property);
        query = query.orderBy(
          expr as any,
          sql.raw(`${direction} nulls last`) as any,
        );
      }
    }
    query = query
      .orderBy(sql`position collate "C"` as any, 'asc')
      .orderBy('id', 'asc');

    const rows = await query
      .offset(offset)
      .limit(limit + 1)
      .execute();

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    return {
      items,
      meta: {
        limit,
        hasNextPage,
        hasPrevPage: offset > 0,
        nextCursor: hasNextPage ? encodeCursor(offset + limit) : null,
        prevCursor: offset > 0 ? encodeCursor(Math.max(0, offset - limit)) : null,
      },
    };
  }

  async lastPosition(
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<string | null> {
    const db = dbOrTx(this.db, trx);
    const row = await db
      .selectFrom('baseRows')
      .select('position')
      .where('pageId', '=', pageId)
      .where('deletedAt', 'is', null)
      .orderBy(sql`position collate "C"` as any, 'desc')
      .limit(1)
      .executeTakeFirst();
    return row?.position ?? null;
  }

  async positionAfter(
    pageId: string,
    rowId: string,
    trx?: KyselyTransaction,
  ): Promise<{ position: string; next: string | null } | null> {
    const db = dbOrTx(this.db, trx);
    const anchor = await db
      .selectFrom('baseRows')
      .select('position')
      .where('pageId', '=', pageId)
      .where('id', '=', rowId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
    if (!anchor) return null;
    const next = await db
      .selectFrom('baseRows')
      .select('position')
      .where('pageId', '=', pageId)
      .where('deletedAt', 'is', null)
      .where(sql`position collate "C"` as any, '>', anchor.position)
      .orderBy(sql`position collate "C"` as any, 'asc')
      .limit(1)
      .executeTakeFirst();
    return { position: anchor.position, next: next?.position ?? null };
  }

  async insert(
    row: InsertableBaseRow,
    trx?: KyselyTransaction,
  ): Promise<BaseRow> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('baseRows')
      .values(row)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  // Applies a cell patch: null values delete keys (jsonb_set_many).
  async patchCells(
    rowId: string,
    cellPatch: Record<string, unknown>,
    userId: string | null,
    trx?: KyselyTransaction,
  ): Promise<BaseRow | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('baseRows')
      .set({
        cells: sql`jsonb_set_many(cells, ${JSON.stringify(cellPatch)}::jsonb)`,
        lastUpdatedById: userId,
        updatedAt: new Date(),
      })
      .where('id', '=', rowId)
      .where('deletedAt', 'is', null)
      .returningAll()
      .executeTakeFirst();
  }

  async updatePosition(
    rowId: string,
    position: string,
    userId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('baseRows')
      .set({ position, lastUpdatedById: userId, updatedAt: new Date() })
      .where('id', '=', rowId)
      .execute();
  }

  async softDelete(
    pageId: string,
    rowIds: string[],
    trx?: KyselyTransaction,
  ): Promise<void> {
    if (rowIds.length === 0) return;
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('baseRows')
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where('pageId', '=', pageId)
      .where('id', 'in', rowIds)
      .execute();
  }

  // Removes a property's key from every row's cells (property deletion GC).
  async removeCellKey(
    pageId: string,
    propertyId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('baseRows')
      .set({ cells: sql`cells - ${propertyId}` })
      .where('pageId', '=', pageId)
      .where(sql`cells ? ${propertyId}` as any)
      .execute();
  }

  // Streams live rows in id order for batch jobs (conversion, formula
  // recompute, CSV export).
  async findAllLive(
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<BaseRow[]> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('baseRows')
      .selectAll()
      .where('pageId', '=', pageId)
      .where('deletedAt', 'is', null)
      .orderBy(sql`position collate "C"` as any, 'asc')
      .orderBy('id', 'asc')
      .execute();
  }

  async setCellValue(
    rowId: string,
    propertyId: string,
    value: unknown,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    const patch = JSON.stringify({ [propertyId]: value ?? null });
    await db
      .updateTable('baseRows')
      .set({
        cells: sql`jsonb_set_many(cells, ${patch}::jsonb)`,
        updatedAt: new Date(),
      })
      .where('id', '=', rowId)
      .execute();
  }
}
