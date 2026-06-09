import { CamelCasePlugin, DummyDriver, Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from 'kysely';
import { DatabaseViewRepo } from './database-view.repo';
import { KyselyDB } from '../../types/kysely.types';

// A compile-only Kysely: no connection, captures the SQL each repo method emits
// so we can assert the orphan filters / empty-array guard without a live DB.
function compileOnlyDb(): { db: KyselyDB; sql: () => string; params: () => readonly unknown[] } {
  let lastSql = '';
  let lastParams: readonly unknown[] = [];
  const db = new Kysely<any>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (d) => new PostgresIntrospector(d),
      createQueryCompiler: () => {
        const compiler = new PostgresQueryCompiler();
        const orig = compiler.compileQuery.bind(compiler);
        compiler.compileQuery = (node: any) => {
          const compiled = orig(node);
          lastSql = compiled.sql;
          lastParams = compiled.parameters;
          return compiled;
        };
        return compiler;
      },
    },
    plugins: [new CamelCasePlugin()],
  }) as unknown as KyselyDB;
  return { db, sql: () => lastSql, params: () => lastParams };
}

describe('DatabaseViewRepo SQL', () => {
  it('findByScope filters out soft-deleted (orphaned_at IS NULL)', async () => {
    const { db, sql } = compileOnlyDb();
    const repo = new DatabaseViewRepo(db);
    await repo
      .findByScope({ databaseId: 'd1', embedId: 'e1', ownerUserId: 'u1' })
      .catch(() => undefined);
    expect(sql()).toContain('"orphaned_at" is null');
  });

  it('softDeleteOrphans casts empty keep list to varchar[] so <> ALL is true', async () => {
    const { db, sql, params } = compileOnlyDb();
    const repo = new DatabaseViewRepo(db);
    await repo
      .softDeleteOrphans({ sourcePageId: 'p1', keepEmbedIds: [] })
      .catch(() => undefined);
    expect(sql()).toContain('<> ALL(');
    expect(sql()).toContain('::varchar[]');
    expect(sql()).toContain('"orphaned_at" is null');
    expect(params()).toContainEqual([]);
  });

  it('softDeleteOrphans passes the keep list through as a parameter', async () => {
    const { db, params } = compileOnlyDb();
    const repo = new DatabaseViewRepo(db);
    await repo
      .softDeleteOrphans({ sourcePageId: 'p1', keepEmbedIds: ['a', 'b'] })
      .catch(() => undefined);
    expect(params()).toContainEqual(['a', 'b']);
  });

  it('restoreOrphans is a no-op when embedIds is empty', async () => {
    const { db, sql } = compileOnlyDb();
    const repo = new DatabaseViewRepo(db);
    await repo.restoreOrphans({ sourcePageId: 'p1', embedIds: [] });
    // no query compiled
    expect(sql()).toBe('');
  });

  it('restoreOrphans clears orphaned_at for the given embedIds', async () => {
    const { db, sql } = compileOnlyDb();
    const repo = new DatabaseViewRepo(db);
    await repo
      .restoreOrphans({ sourcePageId: 'p1', embedIds: ['a'] })
      .catch(() => undefined);
    expect(sql()).toContain('set "orphaned_at" = ');
    expect(sql()).toContain('"orphaned_at" is not null');
    expect(sql()).toContain('"embed_id" in');
  });

  it('hardDeleteOrphanedBefore deletes by orphaned_at cutoff', async () => {
    const { db, sql } = compileOnlyDb();
    const repo = new DatabaseViewRepo(db);
    await repo.hardDeleteOrphanedBefore(new Date()).catch(() => undefined);
    expect(sql()).toContain('delete from "database_views"');
    expect(sql()).toContain('"orphaned_at" is not null');
    expect(sql()).toContain('"orphaned_at" <');
  });
});
