import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import {
  Database,
  InsertableDatabase,
  UpdatableDatabase,
} from '@docmost/db/types/entity.types';
import { dbOrTx } from '@docmost/db/utils';

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
}
