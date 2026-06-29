import { type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Reverting #119: template embed views are replaced by live self-reference,
  // so the per-template embed_views snapshot column is no longer needed.
  await db.schema
    .alterTable('database_templates')
    .dropColumn('embed_views')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('database_templates')
    .addColumn('embed_views', 'jsonb', (col) => col)
    .execute();
}
