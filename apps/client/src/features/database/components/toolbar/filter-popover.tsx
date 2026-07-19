import { Stack, Text, UnstyledButton } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  IDatabaseProperty,
  IFilterCondition,
} from "@/features/database/types/database.types.ts";
import { operatorsForType } from "@/features/database/filters/operators.ts";
import { FilterRow } from "./filter-row";
import classes from "./toolbar.module.css";

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
    <Stack gap="xs" className={classes.popover}>
      <Text size="xs" fw={600} c="dimmed">
        {t("Filter by")}
      </Text>
      {filters.length === 0 && (
        <Text size="xs" c="dimmed">
          {t("No filters applied")}
        </Text>
      )}
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
      <UnstyledButton onClick={addFilter} className={classes.addActionButton}>
        <IconPlus size={14} />
        {t("Add filter")}
      </UnstyledButton>
    </Stack>
  );
}

export default FilterPopover;
