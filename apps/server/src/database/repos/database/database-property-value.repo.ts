import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import {
  DatabasePropertyValue,
  InsertableDatabasePropertyValue,
} from '@docmost/db/types/entity.types';
import { dbOrTx } from '@docmost/db/utils';

@Injectable()
export class DatabasePropertyValueRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findByPageId(
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<DatabasePropertyValue[]> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('databasePropertyValues')
      .selectAll()
      .where('pageId', '=', pageId)
      .execute();
  }

  // Upsert on the (page_id, property_id) unique pair.
  async setValue(
    insertable: InsertableDatabasePropertyValue,
    trx?: KyselyTransaction,
  ): Promise<DatabasePropertyValue> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('databasePropertyValues')
      .values(insertable)
      .onConflict((oc) =>
        oc.columns(['pageId', 'propertyId']).doUpdateSet({
          value: insertable.value,
          updatedAt: new Date(),
        }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async clearValue(
    pageId: string,
    propertyId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('databasePropertyValues')
      .where('pageId', '=', pageId)
      .where('propertyId', '=', propertyId)
      .execute();
  }
}
