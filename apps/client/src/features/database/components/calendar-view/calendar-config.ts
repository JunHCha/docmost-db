import { IDatabaseProperty } from "@/features/database/types/database.types.ts";

// Only date properties can anchor a calendar bar's start / end.
export function dateCandidates(
  properties: IDatabaseProperty[],
): IDatabaseProperty[] {
  return properties.filter((p) => p.type === "date");
}
