import { type Kysely, sql } from 'kysely';

// Consolidated database feature schema. This single migration is the net final
// state of what were originally eight incremental migrations (data model, view
// scope, orphan cleanup, per-scope default index, templates, relation cleanup,
// and the added-then-dropped template embed_views column). The intermediate
// data-only steps (one-way relation purge) are no-ops on a fresh schema and are
// therefore omitted; every schema change they left behind is folded in here.
export async function up(db: Kysely<any>): Promise<void> {
  // page_type discriminator: existing pages are documents, database pages opt in.
  await db.schema
    .alterTable('pages')
    .addColumn('page_type', 'varchar', (col) => col.notNull().defaultTo('doc'))
    .execute();

  // A database is a page (1:1 with pages) plus scope metadata.
  await db.schema
    .createTable('databases')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade').notNull(),
    )
    .addColumn('space_id', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('deleted_at', 'timestamptz', (col) => col)
    .addUniqueConstraint('databases_page_id_unique', ['page_id'])
    .execute();

  await db.schema
    .createIndex('databases_space_id_idx')
    .on('databases')
    .column('space_id')
    .execute();

  await db.schema
    .createIndex('databases_workspace_id_idx')
    .on('databases')
    .column('workspace_id')
    .execute();

  // Column (property) definitions for a database.
  await db.schema
    .createTable('database_properties')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('database_id', 'uuid', (col) =>
      col.references('databases.id').onDelete('cascade').notNull(),
    )
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('type', 'varchar', (col) => col.notNull())
    .addColumn('config', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'{}'::jsonb`),
    )
    .addColumn('position', 'varchar', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('deleted_at', 'timestamptz', (col) => col)
    .execute();

  await db.schema
    .createIndex('database_properties_database_id_idx')
    .on('database_properties')
    .column('database_id')
    .execute();

  // Per-row, per-property value. The row is a page (page=row philosophy).
  await db.schema
    .createTable('database_property_values')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade').notNull(),
    )
    .addColumn('property_id', 'uuid', (col) =>
      col.references('database_properties.id').onDelete('cascade').notNull(),
    )
    .addColumn('value', 'jsonb', (col) => col)
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint('database_property_values_page_id_property_id_unique', [
      'page_id',
      'property_id',
    ])
    .execute();

  await db.schema
    .createIndex('database_property_values_page_id_idx')
    .on('database_property_values')
    .column('page_id')
    .execute();

  await db.schema
    .createIndex('database_property_values_property_id_idx')
    .on('database_property_values')
    .column('property_id')
    .execute();

  // Saved views (table / board / ...) for a database. Two orthogonal scope
  // dimensions sit on top of database_id:
  //   embed_id      NULL = original DB view, value = a specific embed's view
  //   owner_user_id NULL = shared (everyone) view, value = a user's personal view
  // source_page_id back-references the page hosting an embed view (page delete
  // cascades its embed views); orphaned_at soft-deletes an embed view whose node
  // vanished from the doc (NULL = live).
  await db.schema
    .createTable('database_views')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('database_id', 'uuid', (col) =>
      col.references('databases.id').onDelete('cascade').notNull(),
    )
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('type', 'varchar', (col) => col.notNull())
    .addColumn('config', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'{}'::jsonb`),
    )
    .addColumn('is_default', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('position', 'varchar', (col) => col.notNull())
    .addColumn('embed_id', 'varchar', (col) => col)
    .addColumn('owner_user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('cascade'),
    )
    .addColumn('source_page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade'),
    )
    .addColumn('orphaned_at', 'timestamptz', (col) => col)
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('database_views_database_id_idx')
    .on('database_views')
    .column('database_id')
    .execute();

  // Composite index for the 4-quadrant scope lookup (database + embed + owner).
  await db.schema
    .createIndex('database_views_scope_idx')
    .on('database_views')
    .columns(['database_id', 'embed_id', 'owner_user_id'])
    .execute();

  await db.schema
    .createIndex('database_views_source_page_idx')
    .on('database_views')
    .column('source_page_id')
    .execute();

  await sql`CREATE INDEX database_views_orphaned_at_idx ON database_views (orphaned_at) WHERE orphaned_at IS NOT NULL`.execute(
    db,
  );

  // At most one default view per (database, embed, owner) scope. NULLs are
  // DISTINCT in unique indexes, so coalesce them to sentinels. Soft-deleted
  // (orphaned) rows are excluded so they don't reserve the scope's default slot.
  await sql`CREATE UNIQUE INDEX database_views_one_default_per_scope ON database_views (database_id, coalesce(embed_id, ''), coalesce(owner_user_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE is_default AND orphaned_at IS NULL`.execute(
    db,
  );

  // Row-creation templates owned by a database: a preset of property values
  // plus a Tiptap document body that fills a new row when chosen.
  await db.schema
    .createTable('database_templates')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('database_id', 'uuid', (col) =>
      col.references('databases.id').onDelete('cascade').notNull(),
    )
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('icon', 'varchar', (col) => col)
    .addColumn('property_values', 'jsonb', (col) => col)
    .addColumn('content', 'jsonb', (col) => col)
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

  await db.schema
    .createIndex('database_templates_database_id_idx')
    .on('database_templates')
    .column('database_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop in reverse FK dependency order.
  await db.schema.dropTable('database_templates').execute();
  await db.schema.dropTable('database_views').execute();
  await db.schema.dropTable('database_property_values').execute();
  await db.schema.dropTable('database_properties').execute();
  await db.schema.dropTable('databases').execute();
  await db.schema.alterTable('pages').dropColumn('page_type').execute();
}
