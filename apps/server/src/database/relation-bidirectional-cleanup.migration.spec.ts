import {
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type DatabaseConnection,
  type Driver,
  type QueryResult,
} from 'kysely';
// Lives OUTSIDE the migrations/ folder on purpose: Kysely's FileMigrationProvider
// loads EVERY file in that folder as a migration, so a co-located *.spec.ts breaks
// `migration:latest` ("describe is not defined"). jest still finds it via testRegex.
import {
  up,
  down,
} from './migrations/20260610T090000-relation-bidirectional-cleanup';

// Records every compiled SQL string the migration executes, without a real
// database. A minimal Postgres-compiling Kysely lets the tagged `sql` template
// compile normally while the fake driver captures the output.
function recordingDb(executed: string[]): Kysely<any> {
  const connection: DatabaseConnection = {
    async executeQuery(compiled): Promise<QueryResult<any>> {
      executed.push(compiled.sql.replace(/\s+/g, ' ').trim());
      return { rows: [] };
    },
    async *streamQuery() {
      // not used by these migrations
    },
  };
  const driver: Driver = {
    async init() {},
    async acquireConnection() {
      return connection;
    },
    async beginTransaction() {},
    async commitTransaction() {},
    async rollbackTransaction() {},
    async releaseConnection() {},
    async destroy() {},
  };
  return new Kysely<any>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => driver,
      createIntrospector: (db) => new PostgresIntrospector(db),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });
}

describe('20260610T090000-relation-bidirectional-cleanup', () => {
  it('deletes relation values before relation properties', async () => {
    const executed: string[] = [];
    await up(recordingDb(executed));

    expect(executed).toHaveLength(2);
    expect(executed[0]).toMatch(/delete from database_property_values/i);
    expect(executed[0]).toMatch(/type = 'relation'/i);
    expect(executed[1]).toMatch(/delete from database_properties/i);
    expect(executed[1]).toMatch(/type = 'relation'/i);
  });

  it('down is a no-op (irreversible)', async () => {
    await expect(down({} as any)).resolves.toBeUndefined();
  });
});
