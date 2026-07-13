import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  BaseProperty,
  InsertableBaseProperty,
  UpdatableBaseProperty,
} from '@docmost/db/types/entity.types';

@Injectable()
export class BasePropertyRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    pageId: string,
    propertyId: string,
    trx?: KyselyTransaction,
  ): Promise<BaseProperty | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('baseProperties')
      .selectAll()
      .where('pageId', '=', pageId)
      .where('id', '=', propertyId)
      .executeTakeFirst();
  }

  async findLiveByPageId(
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<BaseProperty[]> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('baseProperties')
      .selectAll()
      .where('pageId', '=', pageId)
      .where('deletedAt', 'is', null)
      .orderBy('position', 'asc')
      .orderBy('id', 'asc')
      .execute();
  }

  async insert(
    property: InsertableBaseProperty,
    trx?: KyselyTransaction,
  ): Promise<BaseProperty> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('baseProperties')
      .values(property)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async update(
    pageId: string,
    propertyId: string,
    patch: UpdatableBaseProperty,
    trx?: KyselyTransaction,
  ): Promise<BaseProperty | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('baseProperties')
      .set({ ...patch, updatedAt: new Date() })
      .where('pageId', '=', pageId)
      .where('id', '=', propertyId)
      .returningAll()
      .executeTakeFirst();
  }

  async softDelete(
    pageId: string,
    propertyId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('baseProperties')
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where('pageId', '=', pageId)
      .where('id', '=', propertyId)
      .execute();
  }
}
