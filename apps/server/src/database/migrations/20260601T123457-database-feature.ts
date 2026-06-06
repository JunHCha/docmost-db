import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // page_type discriminator: existing pages are documents, database pages opt in.
  await db.schema
    .alterTable('pages')
    .addColumn('page_type', 'varchar', (col) =>
      col.notNull().defaultTo('doc'),
    )
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
    .addColumn('config', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
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

  // Saved views (table / board / ...) for a database.
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
    .addColumn('config', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('is_default', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .addColumn('position', 'varchar', (col) => col.notNull())
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

  // At most one default view per database (the view opened on DB entry).
  await db.schema
    .createIndex('database_views_one_default_per_database')
    .on('database_views')
    .column('database_id')
    .where(sql.ref('is_default'), '=', true)
    .unique()
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop in reverse FK dependency order.
  await db.schema.dropTable('database_views').execute();
  await db.schema.dropTable('database_property_values').execute();
  await db.schema.dropTable('database_properties').execute();
  await db.schema.dropTable('databases').execute();
  await db.schema.alterTable('pages').dropColumn('page_type').execute();
}
