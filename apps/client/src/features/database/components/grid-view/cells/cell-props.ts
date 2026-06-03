import { IDatabaseProperty } from "@/features/database/types/database.types.ts";

export interface CellProps {
  property: IDatabaseProperty;
  // The raw stored value object (tagged), or undefined when the row has no
  // value row for this property (the empty-value convention, conventions §1).
  value: { type: string; value: any } | undefined;
  pageId: string;
  databaseId: string;
}

export type CellComponent = (props: CellProps) => JSX.Element;
