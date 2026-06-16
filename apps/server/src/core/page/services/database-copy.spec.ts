import { buildDatabaseCopyPlan } from './database-copy';
import {
  Database,
  DatabaseProperty,
  DatabaseView,
  DatabasePropertyValue,
} from '@docmost/db/types/entity.types';

function db(over: Partial<Database> = {}): Database {
  return {
    id: 'old-db',
    pageId: 'old-root',
    spaceId: 'space-1',
    workspaceId: 'ws-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...over,
  } as Database;
}

function prop(over: Partial<DatabaseProperty> = {}): DatabaseProperty {
  return {
    id: 'old-prop',
    databaseId: 'old-db',
    name: 'Status',
    type: 'select',
    config: {},
    position: 'a0',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...over,
  } as DatabaseProperty;
}

function view(over: Partial<DatabaseView> = {}): DatabaseView {
  return {
    id: 'old-view',
    databaseId: 'old-db',
    name: 'Table',
    type: 'table',
    config: {},
    isDefault: true,
    position: 'a0',
    embedId: null,
    ownerUserId: null,
    sourcePageId: null,
    orphanedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as DatabaseView;
}

function value(over: Partial<DatabasePropertyValue> = {}): DatabasePropertyValue {
  return {
    id: 'old-val',
    pageId: 'old-row',
    propertyId: 'old-prop',
    value: { value: 'todo' },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as DatabasePropertyValue;
}

describe('buildDatabaseCopyPlan', () => {
  const baseArgs = () => ({
    source: db(),
    properties: [prop()],
    views: [view()],
    propertyValues: [value()],
    newRootPageId: 'new-root',
    newDatabaseId: 'new-db',
    targetSpaceId: 'space-2',
    targetWorkspaceId: 'ws-1',
    // old row page -> new row page
    pageIdMap: new Map([
      ['old-root', 'new-root'],
      ['old-row', 'new-row'],
    ]),
    newId: (() => {
      let n = 0;
      return () => `gen-${++n}`;
    })(),
  });

  it('creates a database row bound to the new root page and target scope', () => {
    const plan = buildDatabaseCopyPlan(baseArgs());
    expect(plan.database).toEqual({
      id: 'new-db',
      pageId: 'new-root',
      spaceId: 'space-2',
      workspaceId: 'ws-1',
    });
  });

  it('remaps each property to the new database with a fresh id', () => {
    const plan = buildDatabaseCopyPlan(baseArgs());
    expect(plan.properties).toHaveLength(1);
    expect(plan.properties[0]).toMatchObject({
      id: 'gen-1',
      databaseId: 'new-db',
      name: 'Status',
      type: 'select',
      position: 'a0',
    });
  });

  it('remaps shared views to the new database with fresh ids', () => {
    const plan = buildDatabaseCopyPlan(baseArgs());
    expect(plan.views).toHaveLength(1);
    expect(plan.views[0]).toMatchObject({
      databaseId: 'new-db',
      name: 'Table',
      type: 'table',
      isDefault: true,
    });
    expect(plan.views[0].id).not.toBe('old-view');
  });

  it('skips embed-scoped and personal views (only base views are copied)', () => {
    const args = baseArgs();
    args.views = [
      view({ id: 'shared' }),
      view({ id: 'embed', embedId: 'e1' }),
      view({ id: 'personal', ownerUserId: 'u1' }),
      view({ id: 'orphan', orphanedAt: new Date() }),
    ];
    const plan = buildDatabaseCopyPlan(args);
    expect(plan.views).toHaveLength(1);
    expect(plan.views[0].name).toBe('Table');
  });

  it('remaps property values onto the copied row pages and new property ids', () => {
    const plan = buildDatabaseCopyPlan(baseArgs());
    expect(plan.propertyValues).toHaveLength(1);
    expect(plan.propertyValues[0]).toMatchObject({
      pageId: 'new-row',
      propertyId: 'gen-1',
      value: { value: 'todo' },
    });
  });

  it('drops property values whose row page was not copied', () => {
    const args = baseArgs();
    args.propertyValues = [
      value({ pageId: 'old-row' }),
      value({ pageId: 'unknown-row' }),
    ];
    const plan = buildDatabaseCopyPlan(args);
    expect(plan.propertyValues).toHaveLength(1);
    expect(plan.propertyValues[0].pageId).toBe('new-row');
  });

  it('drops property values for properties that were not copied', () => {
    const args = baseArgs();
    args.propertyValues = [value({ propertyId: 'ghost-prop' })];
    const plan = buildDatabaseCopyPlan(args);
    expect(plan.propertyValues).toHaveLength(0);
  });
});
