import {
  IDatabaseProperty,
  IViewColumnConfig,
} from "@/features/database/types/database.types.ts";

// Default width (px) for columns without an explicit width in the view config.
// Also the column width used by the fixed table layout so cells don't reflow
// when switching a cell into edit mode.
export const DEFAULT_COLUMN_WIDTH = 180;

// Compact default width for select / multi_select columns. Their cells only
// render option pills, so the full text-column width wastes horizontal space
// that the data columns need. Only the default changes — an explicit width in
// the view config (user resize) still wins.
export const SELECT_COLUMN_WIDTH = 140;

export interface ResolvedColumn {
  property: IDatabaseProperty;
  width: number;
}

// Type-aware default column width: select / multi_select get the compact width,
// everything else the standard default.
function defaultWidthFor(property: IDatabaseProperty): number {
  return property.type === "select" || property.type === "multi_select"
    ? SELECT_COLUMN_WIDTH
    : DEFAULT_COLUMN_WIDTH;
}

function byPosition(a: IDatabaseProperty, b: IDatabaseProperty): number {
  return a.position.localeCompare(b.position);
}

// Order the properties the way the active view wants them rendered:
// config.columns order first, properties missing from the config trail by
// position. config entries referencing deleted properties are ignored, and an
// empty/absent config falls back to position order (legacy DBs/views).
function orderProperties(
  properties: IDatabaseProperty[],
  columns: IViewColumnConfig[] | undefined,
): IDatabaseProperty[] {
  if (!columns || columns.length === 0) {
    return [...properties].sort(byPosition);
  }
  const byId = new Map(properties.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const ordered: IDatabaseProperty[] = [];
  for (const col of columns) {
    const prop = byId.get(col.propertyId);
    if (prop && !seen.has(prop.id)) {
      ordered.push(prop);
      seen.add(prop.id);
    }
  }
  const rest = properties
    .filter((p) => !seen.has(p.id))
    .sort(byPosition);
  return [...ordered, ...rest];
}

// The display columns for the grid: ordered, with hidden columns removed and a
// resolved width per column.
export function resolveColumns(
  properties: IDatabaseProperty[],
  columns: IViewColumnConfig[] | undefined,
): ResolvedColumn[] {
  const config = new Map((columns ?? []).map((c) => [c.propertyId, c]));
  return orderProperties(properties, columns)
    .filter((p) => config.get(p.id)?.visible !== false)
    .map((property) => ({
      property,
      width: config.get(property.id)?.width ?? defaultWidthFor(property),
    }));
}

// Build the full columns array to persist via updateView. The view config is
// replaced wholesale on update, so we echo an entry for every property — prior
// visibility/width is preserved, and `patch` overrides a single column. Columns
// are emitted in resolved display order so a reorder is captured too.
export function echoColumns(
  properties: IDatabaseProperty[],
  columns: IViewColumnConfig[] | undefined,
  patch?: Partial<IViewColumnConfig> & { propertyId: string },
): IViewColumnConfig[] {
  const prior = new Map((columns ?? []).map((c) => [c.propertyId, c]));
  return orderProperties(properties, columns).map((property) => {
    const existing = prior.get(property.id);
    const merged: IViewColumnConfig = {
      propertyId: property.id,
      visible: existing?.visible ?? true,
      ...(existing?.width !== undefined ? { width: existing.width } : {}),
    };
    if (patch && patch.propertyId === property.id) {
      if (patch.visible !== undefined) merged.visible = patch.visible;
      if (patch.width !== undefined) merged.width = patch.width;
    }
    return merged;
  });
}
