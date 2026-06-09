import { type Kysely, sql } from 'kysely';

// The per-scope "one default view" partial-unique index (added in
// 20260607T100000) only filtered on `is_default`. A soft-deleted default embed
// view (orphaned_at set, is_default still true — see issue #60 reconcile) keeps
// occupying that index, so a re-seed of the same scope could collide (23505).
// Exclude orphaned rows from the index so soft-deleted defaults no longer
// reserve the scope's single-default slot.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('database_views_one_default_per_scope').execute();

  await sql`CREATE UNIQUE INDEX database_views_one_default_per_scope ON database_views (database_id, coalesce(embed_id, ''), coalesce(owner_user_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE is_default AND orphaned_at IS NULL`.execute(
    db,
  );
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('database_views_one_default_per_scope').execute();

  await sql`CREATE UNIQUE INDEX database_views_one_default_per_scope ON database_views (database_id, coalesce(embed_id, ''), coalesce(owner_user_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE is_default`.execute(
    db,
  );
}
