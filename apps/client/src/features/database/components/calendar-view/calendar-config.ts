import { IDatabaseProperty } from "@/features/database/types/database.types.ts";

// Only date properties can anchor a calendar bar.
export function dateCandidates(
  properties: IDatabaseProperty[],
): IDatabaseProperty[] {
  return properties.filter((p) => p.type === "date");
}

// The date property a calendar view auto-adopts when none is configured: the
// first date candidate in display order (properties arrive position-sorted).
export function defaultDateProperty(
  properties: IDatabaseProperty[],
): IDatabaseProperty | undefined {
  return dateCandidates(properties)[0];
}
