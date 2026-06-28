import { type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Templates have no backing page, so embed view settings (filters/sorts/etc.)
  // cannot live in the page-scoped database_views table. Store them on the
  // template as { [embedId]: StoredEmbedView[] } and seed them onto the new
  // row's embed scope at row creation. See issue #115.
  await db.schema
    .alterTable('database_templates')
    .addColumn('embed_views', 'jsonb', (col) => col)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('database_templates')
    .dropColumn('embed_views')
    .execute();
}
