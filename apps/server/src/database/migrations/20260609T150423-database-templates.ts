import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
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
  await db.schema.dropTable('database_templates').execute();
}
