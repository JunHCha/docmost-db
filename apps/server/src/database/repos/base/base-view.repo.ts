import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  BaseView,
  InsertableBaseView,
  UpdatableBaseView,
} from '@docmost/db/types/entity.types';

export type ViewScope = {
  pageId: string;
  // null = views on the base page itself, string = views of one embed block
  embedId: string | null;
};

@Injectable()
export class BaseViewRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    viewId: string,
    trx?: KyselyTransaction,
  ): Promise<BaseView | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('baseViews')
      .selectAll()
      .where('id', '=', viewId)
      .executeTakeFirst();
  }

  // Shared views of the scope plus the requesting user's personal views.
  async findByScope(
    scope: ViewScope,
    userId: string,
    trx?: KyselyTransaction,
  ): Promise<BaseView[]> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('baseViews')
      .selectAll()
      .where('pageId', '=', scope.pageId)
      .where(sql`embed_id is not distinct from ${scope.embedId}` as any)
      .where('orphanedAt', 'is', null)
      .where((eb) =>
        eb.or([
          eb('ownerUserId', 'is', null),
          eb('ownerUserId', '=', userId),
        ]),
      )
      .orderBy(sql`position collate "C"` as any, 'asc')
      .orderBy('id', 'asc')
      .execute();
  }

  async insert(
    view: InsertableBaseView,
    trx?: KyselyTransaction,
  ): Promise<BaseView> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('baseViews')
      .values(view)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async update(
    viewId: string,
    patch: UpdatableBaseView,
    trx?: KyselyTransaction,
  ): Promise<BaseView | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('baseViews')
      .set({ ...patch, updatedAt: new Date() })
      .where('id', '=', viewId)
      .returningAll()
      .executeTakeFirst();
  }

  async delete(viewId: string, trx?: KyselyTransaction): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db.deleteFrom('baseViews').where('id', '=', viewId).execute();
  }

  async clearDefaults(
    scope: ViewScope,
    ownerUserId: string | null,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('baseViews')
      .set({ isDefault: false, updatedAt: new Date() })
      .where('pageId', '=', scope.pageId)
      .where(sql`embed_id is not distinct from ${scope.embedId}` as any)
      .where(sql`owner_user_id is not distinct from ${ownerUserId}` as any)
      .where('isDefault', '=', true)
      .execute();
  }

  // Embed-view orphan reconcile: soft-delete views whose embed block
  // disappeared from the host document, restore them when it reappears
  // (undo-safe).
  async softDeleteOrphans(
    sourcePageId: string,
    liveEmbedIds: string[],
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    let query = db
      .updateTable('baseViews')
      .set({ orphanedAt: new Date(), updatedAt: new Date() })
      .where('sourcePageId', '=', sourcePageId)
      .where('embedId', 'is not', null)
      .where('orphanedAt', 'is', null);
    if (liveEmbedIds.length > 0) {
      query = query.where('embedId', 'not in', liveEmbedIds);
    }
    await query.execute();
  }

  async restoreOrphans(
    sourcePageId: string,
    liveEmbedIds: string[],
    trx?: KyselyTransaction,
  ): Promise<void> {
    if (liveEmbedIds.length === 0) return;
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('baseViews')
      .set({ orphanedAt: null, updatedAt: new Date() })
      .where('sourcePageId', '=', sourcePageId)
      .where('embedId', 'in', liveEmbedIds)
      .where('orphanedAt', 'is not', null)
      .execute();
  }

  async hardDeleteOrphanedBefore(cutoff: Date): Promise<number> {
    const result = await this.db
      .deleteFrom('baseViews')
      .where('orphanedAt', 'is not', null)
      .where('orphanedAt', '<', cutoff)
      .executeTakeFirst();
    return Number(result?.numDeletedRows ?? 0);
  }
}
