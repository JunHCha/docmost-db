import {
  Database,
  DatabaseProperty,
  DatabaseView,
  DatabasePropertyValue,
  InsertableDatabase,
  InsertableDatabaseProperty,
  InsertableDatabaseView,
  InsertableDatabasePropertyValue,
} from '@docmost/db/types/entity.types';

export interface DatabaseCopyArgs {
  // The source database row and its full structure.
  source: Database;
  properties: DatabaseProperty[];
  views: DatabaseView[];
  propertyValues: DatabasePropertyValue[];
  // The already-allocated ids for the duplicated database page/row.
  newRootPageId: string;
  newDatabaseId: string;
  targetSpaceId: string;
  targetWorkspaceId: string;
  // old page id -> new page id, for the database page and every copied row.
  pageIdMap: Map<string, string>;
  // id generator (uuid7) — injected so the plan is deterministic in tests.
  newId: () => string;
}

export interface DatabaseCopyPlan {
  database: InsertableDatabase;
  properties: InsertableDatabaseProperty[];
  views: InsertableDatabaseView[];
  propertyValues: InsertableDatabasePropertyValue[];
}

// Pure planner for duplicating a database alongside its page tree (issue #84).
// Given the source database's structure and the page-id remap produced by the
// page-tree copy, it returns the insertable database/property/view/value rows
// with fresh ids so the duplicate is a real, independent database rather than a
// plain page. Side-effect free so it can be unit-tested without a DB.
export function buildDatabaseCopyPlan(
  args: DatabaseCopyArgs,
): DatabaseCopyPlan {
  const {
    properties,
    views,
    propertyValues,
    newRootPageId,
    newDatabaseId,
    targetSpaceId,
    targetWorkspaceId,
    pageIdMap,
    newId,
  } = args;

  const database: InsertableDatabase = {
    id: newDatabaseId,
    pageId: newRootPageId,
    spaceId: targetSpaceId,
    workspaceId: targetWorkspaceId,
  };

  // old property id -> new property id, needed to remap values below.
  const propertyIdMap = new Map<string, string>();
  const newProperties: InsertableDatabaseProperty[] = properties.map((p) => {
    const id = newId();
    propertyIdMap.set(p.id, id);
    return {
      id,
      databaseId: newDatabaseId,
      name: p.name,
      type: p.type,
      config: p.config,
      position: p.position,
    };
  });

  // Only copy the database's base, shared views. Embed-scoped views (embedId)
  // and per-user personal views (ownerUserId) belong to a specific embed/user
  // and must not leak into the duplicate; orphaned views are pending deletion.
  const newViews: InsertableDatabaseView[] = views
    .filter(
      (v) => !v.embedId && !v.ownerUserId && !v.orphanedAt,
    )
    .map((v) => ({
      id: newId(),
      databaseId: newDatabaseId,
      name: v.name,
      type: v.type,
      config: v.config,
      isDefault: v.isDefault,
      position: v.position,
    }));

  // Remap each value onto its copied row page and copied property. Values whose
  // row page was not copied (e.g. inaccessible) or whose property is gone are
  // dropped.
  const newPropertyValues: InsertableDatabasePropertyValue[] = [];
  for (const value of propertyValues) {
    const newPageId = pageIdMap.get(value.pageId);
    const newPropertyId = propertyIdMap.get(value.propertyId);
    if (!newPageId || !newPropertyId) continue;
    newPropertyValues.push({
      id: newId(),
      pageId: newPageId,
      propertyId: newPropertyId,
      value: value.value,
    });
  }

  return {
    database,
    properties: newProperties,
    views: newViews,
    propertyValues: newPropertyValues,
  };
}
