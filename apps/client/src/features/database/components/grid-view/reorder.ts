import { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { IDatabaseProperty } from "@/features/database/types/database.types.ts";

export interface ReorderTarget {
  afterPropertyId: string | undefined;
}

// Translate a drop on `targetId` from a horizontal edge into the
// `afterPropertyId` the reorder API expects. Dropping on the left edge means
// "place before the target", i.e. after the target's previous sibling
// (undefined when the target is first). Dropping on the right edge means
// "place after the target".
export function resolveReorderTarget(
  targetId: string,
  edge: Edge,
  ordered: IDatabaseProperty[],
  sourceId?: string,
): ReorderTarget | null {
  const index = ordered.findIndex((p) => p.id === targetId);
  if (index === -1) return null;

  const afterPropertyId =
    edge === "right"
      ? targetId
      : // left edge: insert before the target, i.e. after its previous sibling
        // (undefined when the target is first).
        ordered[index - 1]?.id;

  // A move whose anchor is the source itself is a no-op and the server rejects
  // `afterPropertyId === propertyId` outright, so drop it here.
  if (sourceId !== undefined && afterPropertyId === sourceId) return null;

  return { afterPropertyId };
}
