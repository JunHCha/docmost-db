import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  BaseTemplate,
  InsertableBaseTemplate,
  UpdatableBaseTemplate,
} from '@docmost/db/types/entity.types';

@Injectable()
export class BaseTemplateRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    templateId: string,
    trx?: KyselyTransaction,
  ): Promise<BaseTemplate | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('baseTemplates')
      .selectAll()
      .where('id', '=', templateId)
      .executeTakeFirst();
  }

  async findByPageId(
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<BaseTemplate[]> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('baseTemplates')
      .selectAll()
      .where('pageId', '=', pageId)
      .orderBy(sql`position collate "C"` as any, 'asc')
      .orderBy('id', 'asc')
      .execute();
  }

  async lastPosition(
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<string | null> {
    const db = dbOrTx(this.db, trx);
    const row = await db
      .selectFrom('baseTemplates')
      .select('position')
      .where('pageId', '=', pageId)
      .orderBy(sql`position collate "C"` as any, 'desc')
      .limit(1)
      .executeTakeFirst();
    return row?.position ?? null;
  }

  async insert(
    template: InsertableBaseTemplate,
    trx?: KyselyTransaction,
  ): Promise<BaseTemplate> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('baseTemplates')
      .values(template)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async update(
    templateId: string,
    patch: UpdatableBaseTemplate,
    trx?: KyselyTransaction,
  ): Promise<BaseTemplate | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('baseTemplates')
      .set({ ...patch, updatedAt: new Date() })
      .where('id', '=', templateId)
      .returningAll()
      .executeTakeFirst();
  }

  async delete(templateId: string, trx?: KyselyTransaction): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('baseTemplates')
      .where('id', '=', templateId)
      .execute();
  }
}
