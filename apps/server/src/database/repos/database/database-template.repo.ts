import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import {
  DatabaseTemplate,
  InsertableDatabaseTemplate,
  UpdatableDatabaseTemplate,
} from '@docmost/db/types/entity.types';
import { dbOrTx } from '@docmost/db/utils';

@Injectable()
export class DatabaseTemplateRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    templateId: string,
    trx?: KyselyTransaction,
  ): Promise<DatabaseTemplate | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('databaseTemplates')
      .selectAll()
      .where('id', '=', templateId)
      .executeTakeFirst();
  }

  async findByDatabaseId(
    databaseId: string,
    trx?: KyselyTransaction,
  ): Promise<DatabaseTemplate[]> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('databaseTemplates')
      .selectAll()
      .where('databaseId', '=', databaseId)
      .orderBy('position', 'asc')
      .execute();
  }

  async create(
    insertable: InsertableDatabaseTemplate,
    trx?: KyselyTransaction,
  ): Promise<DatabaseTemplate> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('databaseTemplates')
      .values(insertable)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async updateTemplate(
    updatable: UpdatableDatabaseTemplate,
    templateId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('databaseTemplates')
      .set({ ...updatable, updatedAt: new Date() })
      .where('id', '=', templateId)
      .execute();
  }

  async deleteTemplate(
    templateId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('databaseTemplates')
      .where('id', '=', templateId)
      .execute();
  }
}
