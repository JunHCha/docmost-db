import { Text } from "@mantine/core";
import { PropertyType } from "@/features/database/types/database.types.ts";
import { CellComponent, CellProps } from "./cell-props";
import { TextCell } from "./text-cell";
import { UrlCell } from "./url-cell";
import { NumberCell } from "./number-cell";
import { CheckboxCell } from "./checkbox-cell";
import { DateCell } from "./date-cell";

// Read-only renderer for property types without a dedicated editor (relation
// lands in #10). Stringifies the stored value so the data is at least visible.
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
};

export function getCellComponent(type: PropertyType): CellComponent {
  return registry[type] ?? FallbackCell;
}
