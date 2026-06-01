import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
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
}
