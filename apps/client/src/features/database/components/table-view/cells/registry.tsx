import { Text } from "@mantine/core";
import { PropertyType } from "@/features/database/types/database.types.ts";
import { CellComponent, CellProps } from "./cell-props";
import { TextCell } from "./text-cell";
import { UrlCell } from "./url-cell";
import { NumberCell } from "./number-cell";
import { CheckboxCell } from "./checkbox-cell";
import { DateCell } from "./date-cell";
import { SelectCell } from "./select-cell";
import { MultiSelectCell } from "./multi-select-cell";
import { RelationCell } from "./relation-cell";
import { PersonCell } from "./person-cell";
import { CreatedByCell } from "./created-by-cell";
import { TimestampCell } from "./timestamp-cell";

// Read-only renderer for property types without a dedicated editor.
// Stringifies the stored value so the data is at least visible.
export function FallbackCell({ value }: CellProps) {
  const text =
    value?.value === undefined || value?.value === null
      ? ""
      : typeof value.value === "object"
        ? JSON.stringify(value.value)
        : String(value.value);
  return (
    <Text size="sm" c="dimmed">
      {text}
    </Text>
  );
}

const registry: Partial<Record<PropertyType, CellComponent>> = {
  text: TextCell,
  url: UrlCell,
  number: NumberCell,
  checkbox: CheckboxCell,
  date: DateCell,
  select: SelectCell,
  multi_select: MultiSelectCell,
  relation: RelationCell,
  person: PersonCell,
  created_by: CreatedByCell,
  created_time: TimestampCell,
  last_edited_time: TimestampCell,
};

export function getCellComponent(type: PropertyType): CellComponent {
  return registry[type] ?? FallbackCell;
}
