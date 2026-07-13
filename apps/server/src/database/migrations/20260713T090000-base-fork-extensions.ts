import { type Kysely, sql } from 'kysely';

// Fork extensions on top of upstream bases (20260529T125146-bases):
// - base_views scope columns for the 4-quadrant view model
//   (original|embed) x (shared|personal), plus per-scope default and
//   orphan soft-delete for embed views (reconciled on document save).
// - base_templates: per-base row templates (cell presets applied on
//   row creation). Rows are plain base_rows records, so templates
//   carry no document content.
// Relation properties need no schema: they live in
// base_properties.type_options and base_rows.cells.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('base_views')
    .addColumn('embed_id', 'varchar')
    .addColumn('owner_user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('cascade'),
    )
    .addColumn('source_page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade'),
    )
    .addColumn('orphaned_at', 'timestamptz')
    .addColumn('is_default', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .execute();

  await sql`
    CREATE INDEX IF NOT EXISTS idx_base_views_scope
      ON base_views (page_id, embed_id, owner_user_id)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_base_views_source_page
      ON base_views (source_page_id)
      WHERE source_page_id IS NOT NULL
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_base_views_orphaned_at
      ON base_views (orphaned_at)
      WHERE orphaned_at IS NOT NULL
  `.execute(db);

  // One default view per (base, embed, owner) scope. Orphaned embed views
  // must not hold the slot, or re-seeding after an undo hits 23505.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS base_views_one_default_per_scope
      ON base_views (
        page_id,
        coalesce(embed_id, ''),
        coalesce(owner_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
      )
      WHERE is_default = true AND orphaned_at IS NULL
  `.execute(db);

  // Rows can be backed by a document page (lazy-created on first open).
  // The page lives under the base page but is hidden from the sidebar
  // tree; its title mirrors the row's primary cell.
  await db.schema
    .alterTable('base_rows')
    .addColumn('row_page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('set null'),
    )
    .execute();

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS base_rows_row_page_unique
      ON base_rows (row_page_id)
      WHERE row_page_id IS NOT NULL
  `.execute(db);

  await db.schema
    .createTable('base_templates')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade').notNull(),
    )
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('icon', 'varchar')
    .addColumn('cells', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'{}'::jsonb`),
    )
    .addColumn('position', 'varchar', (col) => col.notNull())
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await sql`
    CREATE INDEX IF NOT EXISTS idx_base_templates_page_id
      ON base_templates (page_id)
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('base_templates').execute();

  await sql`DROP INDEX IF EXISTS base_rows_row_page_unique`.execute(db);
  await db.schema.alterTable('base_rows').dropColumn('row_page_id').execute();

  await sql`DROP INDEX IF EXISTS base_views_one_default_per_scope`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_base_views_orphaned_at`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_base_views_source_page`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_base_views_scope`.execute(db);

  await db.schema
    .alterTable('base_views')
    .dropColumn('is_default')
    .dropColumn('orphaned_at')
    .dropColumn('source_page_id')
    .dropColumn('owner_user_id')
    .dropColumn('embed_id')
    .execute();
}
