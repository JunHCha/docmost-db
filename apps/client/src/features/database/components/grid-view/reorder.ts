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
): ReorderTarget | null {
  const index = ordered.findIndex((p) => p.id === targetId);
  if (index === -1) return null;

  if (edge === "right") {
    return { afterPropertyId: targetId };
  }
  // left edge: insert before the target.
  const previous = ordered[index - 1];
  return { afterPropertyId: previous?.id };
}
