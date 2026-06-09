import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // source_page_id back-references the page that hosts an embed view so the
  // save-time reconcile can scope its diff and a page hard-delete cascades the
  // embed views it owns. NULL = original DB view (embed_id NULL).
  await db.schema
    .alterTable('database_views')
    .addColumn('source_page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade'),
    )
    .execute();

  // orphaned_at marks a soft-deleted embed view (its node vanished from the
  // doc). NULL = live. Grace batch hard-deletes once it ages past the window.
  await db.schema
    .alterTable('database_views')
    .addColumn('orphaned_at', 'timestamptz', (col) => col)
    .execute();

  await db.schema
    .createIndex('database_views_source_page_idx')
    .on('database_views')
    .column('source_page_id')
    .execute();

  await sql`CREATE INDEX database_views_orphaned_at_idx ON database_views (orphaned_at) WHERE orphaned_at IS NOT NULL`.execute(
    db,
  );
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('database_views_orphaned_at_idx').execute();

  await db.schema.dropIndex('database_views_source_page_idx').execute();

  await db.schema
    .alterTable('database_views')
    .dropColumn('orphaned_at')
    .execute();

  await db.schema
    .alterTable('database_views')
    .dropColumn('source_page_id')
    .execute();
}
