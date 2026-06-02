import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import {
  Database,
  InsertableDatabase,
  UpdatableDatabase,
} from '@docmost/db/types/entity.types';
import { dbOrTx } from '@docmost/db/utils';

// A database row enriched with its page's title/icon, for listing.
export type DatabaseListItem = Database & {
  title: string | null;
  icon: string | null;
};

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

  // Databases in a space, joined with their page for title/icon (for listing).
  async findBySpaceId(
    spaceId: string,
    trx?: KyselyTransaction,
  ): Promise<DatabaseListItem[]> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('databases as d')
      .innerJoin('pages as p', 'p.id', 'd.pageId')
      .where('d.spaceId', '=', spaceId)
      .where('d.deletedAt', 'is', null)
      .where('p.deletedAt', 'is', null)
      .select([
        'd.id',
        'd.pageId',
        'd.spaceId',
        'd.workspaceId',
        'd.createdAt',
        'd.updatedAt',
        'd.deletedAt',
        'p.title',
        'p.icon',
      ])
      .orderBy('d.createdAt', 'asc')
      .execute();
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

  // Rows of a database = the direct child pages of its database page
  // (page=row philosophy). Filters trashed rows; ordered by page position.
  async listRows(databasePageId: string, trx?: KyselyTransaction) {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('pages')
      .select([
        'id',
        'slugId',
        'title',
        'icon',
        'position',
        'parentPageId',
        'spaceId',
        'workspaceId',
        'createdAt',
        'updatedAt',
      ])
      .where('parentPageId', '=', databasePageId)
      .where('deletedAt', 'is', null)
      .orderBy('position', 'asc')
      .execute();
  }
}
