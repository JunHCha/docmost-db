import { type Kysely, sql } from 'kysely';

// Clean slate for bidirectional relations (issue #111). Legacy one-way
// relation data has no reverse pairing (config.relatedPropertyId) and cannot be
// reconstructed, so it is purged entirely:
//   1) delete every relation property's stored values, then
//   2) hard-delete the relation properties themselves.
// Done in this order so the FK (database_property_values.property_id ->
// database_properties.id, ON DELETE CASCADE) stays satisfied even if a future
// schema drops the cascade. New relation columns created after this migration
// are always created in paired (bidirectional) form by the property service.
export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    delete from database_property_values
    where property_id in (
      select id from database_properties where type = 'relation'
    )
  `.execute(db);

  await sql`
    delete from database_properties where type = 'relation'
  `.execute(db);
}

// Irreversible: the purged one-way relation columns and values cannot be
// restored. No-op down (clean-slate migration).
export async function down(_db: Kysely<any>): Promise<void> {
  // intentionally empty — relation data removed in up() is unrecoverable.
}
