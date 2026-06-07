import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import {
  DatabaseView,
  InsertableDatabaseView,
  UpdatableDatabaseView,
} from '@docmost/db/types/entity.types';
import { dbOrTx } from '@docmost/db/utils';

@Injectable()
export class DatabaseViewRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    viewId: string,
    trx?: KyselyTransaction,
  ): Promise<DatabaseView | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('databaseViews')
      .selectAll()
      .where('id', '=', viewId)
      .executeTakeFirst();
  }

  async findByDatabaseId(
    databaseId: string,
    trx?: KyselyTransaction,
  ): Promise<DatabaseView[]> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('databaseViews')
      .selectAll()
      .where('databaseId', '=', databaseId)
      .orderBy('position', 'asc')
      .execute();
  }

  // Views visible in one context: the scope's shared views (owner NULL) plus the
  // current user's personal views. embed_id matches with IS NOT DISTINCT FROM so
  // NULL (original DB) and a concrete embed id both compare correctly.
  async findByScope(
    {
      databaseId,
      embedId,
      ownerUserId,
    }: { databaseId: string; embedId?: string | null; ownerUserId: string },
    trx?: KyselyTransaction,
  ): Promise<DatabaseView[]> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('databaseViews')
      .selectAll()
      .where('databaseId', '=', databaseId)
      .where(
        sql<boolean>`embed_id is not distinct from ${embedId ?? null}`,
      )
      .where((eb) =>
        eb.or([
          eb('ownerUserId', 'is', null),
          eb('ownerUserId', '=', ownerUserId),
        ]),
      )
      .orderBy('position', 'asc')
      .execute();
  }

  async insertView(
    insertable: InsertableDatabaseView,
    trx?: KyselyTransaction,
  ): Promise<DatabaseView> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('databaseViews')
      .values(insertable)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async updateView(
    updatable: UpdatableDatabaseView,
    viewId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('databaseViews')
      .set({ ...updatable, updatedAt: new Date() })
      .where('id', '=', viewId)
      .execute();
  }

  async deleteView(viewId: string, trx?: KyselyTransaction): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db.deleteFrom('databaseViews').where('id', '=', viewId).execute();
  }

  // Reset the default flag for every view in a single scope so set-default can
  // flip a new one without violating the per-scope partial-unique default index.
  async clearDefaultViews(
    {
      databaseId,
      embedId,
      ownerUserId,
    }: {
      databaseId: string;
      embedId?: string | null;
      ownerUserId?: string | null;
    },
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('databaseViews')
      .set({ isDefault: false, updatedAt: new Date() })
      .where('databaseId', '=', databaseId)
      .where(sql<boolean>`embed_id is not distinct from ${embedId ?? null}`)
      .where(
        sql<boolean>`owner_user_id is not distinct from ${ownerUserId ?? null}`,
      )
      .where('isDefault', '=', true)
      .execute();
  }
}
