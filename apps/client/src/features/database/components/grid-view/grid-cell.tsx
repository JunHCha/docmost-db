import {
  IDatabaseProperty,
  IDatabasePropertyValue,
} from "@/features/database/types/database.types.ts";
import { getCellComponent } from "./cells/registry";

interface GridCellProps {
  property: IDatabaseProperty;
  value: IDatabasePropertyValue | undefined;
  pageId: string;
  databaseId: string;
}

export function GridCell({
  property,
  value,
  pageId,
  databaseId,
}: GridCellProps) {
  const Cell = getCellComponent(property.type);
  return (
    <Cell
      property={property}
      value={value?.value}
      pageId={pageId}
      databaseId={databaseId}
    />
  );
}

export default GridCell;
