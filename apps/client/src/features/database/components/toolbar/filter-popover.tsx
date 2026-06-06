import { Button, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  IDatabaseProperty,
  IFilterCondition,
} from "@/features/database/types/database.types.ts";
import { operatorsForType } from "@/features/database/filters/operators.ts";
import { FilterRow } from "./filter-row";

interface FilterPopoverProps {
  properties: IDatabaseProperty[];
  filters: IFilterCondition[];
  onChange: (filters: IFilterCondition[]) => void;
}

// Filter builder body: a list of condition rows combined with And (the core
// only supports And), plus an Add filter action. Rows are addressed by index
// since two conditions can target the same property.
export function FilterPopover({
  properties,
  filters,
  onChange,
}: FilterPopoverProps) {
  const { t } = useTranslation();

  function addFilter() {
    const first = properties[0];
    if (!first) return;
    const op = operatorsForType(first.type)[0]?.op ?? "eq";
    onChange([...filters, { propertyId: first.id, op, value: undefined }]);
  }

  function patch(index: number, next: IFilterCondition) {
    onChange(filters.map((f, i) => (i === index ? next : f)));
  }

  function remove(index: number) {
    onChange(filters.filter((_, i) => i !== index));
  }

  return (
    <Stack gap="xs" miw={260}>
      <Text size="sm" fw={600}>
        {t("Filter")}
      </Text>
      {filters.length > 0 && (
        <Text size="xs" c="dimmed">
          {t("Where")}
        </Text>
      )}
      {filters.map((condition, index) => (
        <FilterRow
          key={index}
          properties={properties}
          condition={condition}
          onChange={(next) => patch(index, next)}
          onRemove={() => remove(index)}
        />
      ))}
      <Button
        variant="subtle"
        size="xs"
        onClick={addFilter}
        style={{ alignSelf: "flex-start" }}
      >
        {t("Add filter")}
      </Button>
    </Stack>
  );
}

export default FilterPopover;
