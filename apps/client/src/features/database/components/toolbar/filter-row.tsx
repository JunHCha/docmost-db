import { useMemo } from "react";
import { ActionIcon, Group, Select } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  IDatabaseProperty,
  IFilterCondition,
} from "@/features/database/types/database.types.ts";
import {
  operatorsForType,
  opNeedsValue,
} from "@/features/database/filters/operators.ts";
import { FilterValueWidget } from "@/features/database/filters/filter-value-widgets.tsx";
import { titleFilterProperty } from "@/features/database/filters/title-filter.ts";
import { PropertyTypeIcon } from "@/features/database/components/property/property-type-icon.tsx";

interface FilterRowProps {
  properties: IDatabaseProperty[];
  condition: IFilterCondition;
  onChange: (next: IFilterCondition) => void;
  onRemove: () => void;
}

// One filter condition: property -> operator (driven by the property type) ->
// value widget. Changing the property resets the operator to the first one
// valid for the new type and drops the now-incompatible value.
export function FilterRow({
  properties,
  condition,
  onChange,
  onRemove,
}: FilterRowProps) {
  const { t } = useTranslation();
  // Title is filterable too, via a synthetic text property prepended to the
  // list (it is not a real database property, so it has no grid column).
  const allProperties = useMemo(
    () => [titleFilterProperty(t("Title")), ...properties],
    [properties, t],
  );
  const property = allProperties.find((p) => p.id === condition.propertyId);

  function changeProperty(propertyId: string | null) {
    const next = allProperties.find((p) => p.id === propertyId);
    if (!next) return;
    const firstOp = operatorsForType(next.type)[0]?.op ?? condition.op;
    onChange({ propertyId: next.id, op: firstOp, value: undefined });
  }

  // Switching to an empty op (is_empty / is_not_empty) drops any stale value so
  // it never lingers in the persisted config; switching back leaves value
  // undefined for the widget to populate.
  function changeOp(op: IFilterCondition["op"]) {
    if (!opNeedsValue(op)) {
      onChange({ propertyId: condition.propertyId, op });
      return;
    }
    onChange({ ...condition, op });
  }

  if (!property) return null;

  const ops = operatorsForType(property.type);

  return (
    <Group gap="xs" wrap="nowrap" align="center">
      <Select
        aria-label={t("Filter property")}
        data={allProperties.map((p) => ({ value: p.id, label: p.name }))}
        value={condition.propertyId}
        onChange={changeProperty}
        comboboxProps={{ withinPortal: false }}
        size="xs"
        w={120}
        renderOption={({ option }) => {
          const p = allProperties.find((x) => x.id === option.value);
          return (
            <Group gap={6} wrap="nowrap">
              {p && <PropertyTypeIcon type={p.type} size={14} />}
              <span>{option.label}</span>
            </Group>
          );
        }}
      />
      <Select
        aria-label={t("Filter operator")}
        data={ops.map((o) => ({ value: o.op, label: t(o.label) }))}
        value={condition.op}
        onChange={(op) => op && changeOp(op as IFilterCondition["op"])}
        comboboxProps={{ withinPortal: false }}
        size="xs"
        w={140}
      />
      {opNeedsValue(condition.op) && (
        <FilterValueWidget
          property={property}
          op={condition.op}
          value={condition.value}
          onChange={(value) => onChange({ ...condition, value })}
        />
      )}
      <ActionIcon
        variant="subtle"
        color="gray"
        size="sm"
        aria-label={t("Remove filter")}
        onClick={onRemove}
      >
        <IconTrash size={14} />
      </ActionIcon>
    </Group>
  );
}

export default FilterRow;
