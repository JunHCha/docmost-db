import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Two orthogonal scope dimensions on top of database_id:
  //   embed_id      NULL = original DB view, value = a specific embed's view layer
  //   owner_user_id NULL = shared (everyone) view, value = a user's personal view
  await db.schema
    .alterTable('database_views')
    .addColumn('embed_id', 'varchar', (col) => col)
    .execute();

  await db.schema
    .alterTable('database_views')
    .addColumn('owner_user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('cascade'),
    )
    .execute();

  // Composite index for the 4-quadrant scope lookup (database + embed + owner).
  await db.schema
    .createIndex('database_views_scope_idx')
    .on('database_views')
    .columns(['database_id', 'embed_id', 'owner_user_id'])
    .execute();

  // Replace the global "one default per database" partial-unique index with a
  // per-scope one. NULLs are DISTINCT in unique indexes, so coalesce them to
  // sentinels to keep at most one default per (database, embed, owner) scope.
  await db.schema.dropIndex('database_views_one_default_per_database').execute();

  await sql`CREATE UNIQUE INDEX database_views_one_default_per_scope ON database_views (database_id, coalesce(embed_id, ''), coalesce(owner_user_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE is_default`.execute(
    db,
  );
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('database_views_one_default_per_scope').execute();

  await db.schema
    .createIndex('database_views_one_default_per_database')
    .on('database_views')
    .column('database_id')
    .where(sql.ref('is_default'), '=', true)
    .unique()
    .execute();

  await db.schema.dropIndex('database_views_scope_idx').execute();

  await db.schema
    .alterTable('database_views')
    .dropColumn('owner_user_id')
    .execute();

  await db.schema.alterTable('database_views').dropColumn('embed_id').execute();
}
