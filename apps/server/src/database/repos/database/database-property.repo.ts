import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import {
  DatabaseProperty,
  InsertableDatabaseProperty,
  UpdatableDatabaseProperty,
} from '@docmost/db/types/entity.types';
import { dbOrTx } from '@docmost/db/utils';

@Injectable()
export class DatabasePropertyRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    propertyId: string,
    trx?: KyselyTransaction,
  ): Promise<DatabaseProperty | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('databaseProperties')
      .selectAll()
      .where('id', '=', propertyId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async findByDatabaseId(
    databaseId: string,
    trx?: KyselyTransaction,
  ): Promise<DatabaseProperty[]> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('databaseProperties')
      .selectAll()
      .where('databaseId', '=', databaseId)
      .where('deletedAt', 'is', null)
      .orderBy('position', 'asc')
      .execute();
  }

  async insertProperty(
    insertable: InsertableDatabaseProperty,
    trx?: KyselyTransaction,
  ): Promise<DatabaseProperty> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('databaseProperties')
      .values(insertable)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async updateProperty(
    updatable: UpdatableDatabaseProperty,
    propertyId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('databaseProperties')
      .set({ ...updatable, updatedAt: new Date() })
      .where('id', '=', propertyId)
      .execute();
  }
}
