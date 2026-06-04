import { IDatabaseProperty } from "@/features/database/types/database.types.ts";

// Only select / multi_select properties can group a board into columns.
export function groupByCandidates(
  properties: IDatabaseProperty[],
): IDatabaseProperty[] {
  return properties.filter(
    (p) => p.type === "select" || p.type === "multi_select",
  );
}

// Toggle a property id in the card-properties list (add when absent, remove
// when present). Returns a fresh array so it can be echoed into updateView.
export function toggleCardProperty(
  current: string[] | undefined,
  propertyId: string,
): string[] {
  const list = current ?? [];
  return list.includes(propertyId)
    ? list.filter((id) => id !== propertyId)
    : [...list, propertyId];
}
