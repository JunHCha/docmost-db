import { IDatabaseProperty } from "@/features/database/types/database.types.ts";

export interface CellProps {
  property: IDatabaseProperty;
  // The raw stored value object (tagged), or undefined when the row has no
  // value row for this property (the empty-value convention, conventions §1).
  value: { type: string; value: any } | undefined;
  pageId: string;
  databaseId: string;
  // Show a dimmed "Empty" placeholder in empty inline cells. Only the row
  // detail property panel sets this — the grid would otherwise fill every blank
  // cell with "Empty" and read as noise (issue #93 follow-up). Defaults off.
  showEmptyPlaceholder?: boolean;
}

export type CellComponent = (props: CellProps) => JSX.Element;
