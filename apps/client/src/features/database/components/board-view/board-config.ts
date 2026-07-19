import {
  IDatabaseProperty,
  IDatabaseViewConfig,
  IViewColumnConfig,
} from "@/features/database/types/database.types.ts";

// Only select / multi_select properties can group a board into columns.
export function groupByCandidates(
  properties: IDatabaseProperty[],
): IDatabaseProperty[] {
  return properties.filter(
    (p) => p.type === "select" || p.type === "multi_select",
  );
}

// The config a freshly created board view starts with, so it is useful the
// moment it opens instead of landing on the "pick a property to group by"
// empty state (#1, #2):
//   - group by the first `select` property — the natural column axis for a
//     board (a plain single-choice status/stage). multi_select is skipped: its
//     add-only drop semantics make a poor default grouping.
//   - hide `relation` columns on the cards by default — they render wide,
//     link-heavy pills that clutter a card; users re-enable them per view via
//     the Properties menu. Only emitted when the database actually has a
//     relation column, so boards without one keep the empty (position-order)
//     columns default.
// Returns {} when there is nothing worth seeding (no select, no relation), so
// the board still falls back to its normal empty states.
export function initialBoardConfig(
  properties: IDatabaseProperty[],
): IDatabaseViewConfig {
  const config: IDatabaseViewConfig = {};

  const firstSelect = properties.find((p) => p.type === "select");
  if (firstSelect) config.groupByPropertyId = firstSelect.id;

  if (properties.some((p) => p.type === "relation")) {
    config.columns = properties.map<IViewColumnConfig>((p) => ({
      propertyId: p.id,
      visible: p.type !== "relation",
    }));
  }

  return config;
}
