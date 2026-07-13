import { BaseProperty, BaseRow, BaseView } from '@docmost/db/types/entity.types';

// Socket payloads relayed verbatim to the `base-${pageId}` room. The
// client drops events whose requestId it minted itself (optimistic echo
// suppression), so every mutation path must thread requestId through.

export type BaseSocketEvent =
  | { operation: 'base:subscribed'; pageId: string; schemaVersion: number }
  | {
      operation: 'base:row:created';
      pageId: string;
      row: SerializedRow;
      requestId?: string;
    }
  | {
      operation: 'base:row:updated';
      pageId: string;
      rowId: string;
      updatedCells: Record<string, unknown>;
      requestId?: string;
    }
  | {
      operation: 'base:row:deleted';
      pageId: string;
      rowId: string;
      requestId?: string;
    }
  | {
      operation: 'base:rows:deleted';
      pageId: string;
      rowIds: string[];
      requestId?: string;
    }
  | {
      operation: 'base:row:reordered';
      pageId: string;
      rowId: string;
      position: string;
      requestId?: string;
    }
  | {
      operation: 'base:rows:updated';
      pageId: string;
      rowIds: string[];
      propertyIds: string[];
      requestId?: string;
    }
  | { operation: 'base:schema:bumped'; pageId: string; schemaVersion: number }
  | {
      operation: 'base:formula:recompute:started';
      pageId: string;
      propertyIds: string[];
      jobId: string;
    }
  | {
      operation: 'base:formula:recompute:completed';
      pageId: string;
      propertyIds: string[];
      jobId: string;
      processed: number;
      errored: number;
    }
  | {
      operation:
        | 'base:property:created'
        | 'base:property:updated'
        | 'base:property:deleted'
        | 'base:property:reordered';
      pageId: string;
      property?: SerializedProperty;
      propertyId?: string;
      requestId?: string;
    }
  | {
      operation: 'base:view:created' | 'base:view:updated' | 'base:view:deleted';
      pageId: string;
      view?: SerializedView;
      viewId?: string;
    };

export type SerializedProperty = ReturnType<typeof serializeProperty>;
export type SerializedRow = ReturnType<typeof serializeRow>;
export type SerializedView = ReturnType<typeof serializeView>;

export function serializeProperty(property: BaseProperty) {
  return {
    id: property.id,
    pageId: property.pageId,
    name: property.name,
    type: property.type,
    position: property.position,
    typeOptions: property.typeOptions ?? {},
    pendingType: property.pendingType,
    pendingTypeOptions: property.pendingTypeOptions,
    isPrimary: property.isPrimary,
    workspaceId: property.workspaceId,
    createdAt: property.createdAt,
    updatedAt: property.updatedAt,
  };
}

export function serializeRow(row: BaseRow) {
  return {
    id: row.id,
    pageId: row.pageId,
    cells: (row.cells ?? {}) as Record<string, unknown>,
    position: row.position,
    creatorId: row.creatorId,
    lastUpdatedById: row.lastUpdatedById,
    workspaceId: row.workspaceId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function serializeView(view: BaseView) {
  return {
    id: view.id,
    pageId: view.pageId,
    name: view.name,
    type: view.type,
    config: (view.config ?? {}) as Record<string, unknown>,
    position: view.position,
    workspaceId: view.workspaceId,
    creatorId: view.creatorId,
    createdAt: view.createdAt,
    updatedAt: view.updatedAt,
    // Fork: view scoping (original|embed) x (shared|personal)
    embedId: view.embedId,
    ownerUserId: view.ownerUserId,
    sourcePageId: view.sourcePageId,
    isDefault: view.isDefault,
  };
}
