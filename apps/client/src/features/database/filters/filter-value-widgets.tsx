import { NumberInput, Select, Switch, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useTranslation } from "react-i18next";
import {
  FilterOp,
  IDatabaseProperty,
} from "@/features/database/types/database.types.ts";
import { getOptions } from "@/features/database/components/property/option-config.ts";
import {
  useDatabaseRowsQuery,
  useDefaultViewId,
} from "@/features/database/queries/database-query.ts";
import { opNeedsValue } from "./operators";

interface FilterValueWidgetProps {
  property: IDatabaseProperty;
  op: FilterOp;
  value: unknown;
  onChange: (value: unknown) => void;
}

const LABEL = "Filter value";

// Picker over the target database's rows for a relation filter. The raw
// comparison value is a single page id ("contains <id>"), mirroring how the
// server matches a relation array against one id.
function RelationValueWidget({
  property,
  value,
  onChange,
}: Omit<FilterValueWidgetProps, "op">) {
  const targetDatabaseId =
    typeof property.config?.targetDatabaseId === "string"
      ? property.config.targetDatabaseId
      : "";
  const targetViewId = useDefaultViewId(targetDatabaseId);
  const { data: rows } = useDatabaseRowsQuery(targetDatabaseId, targetViewId);
  const data = (rows ?? []).map((r) => ({
    value: r.row.id,
    label: r.row.title || "Untitled",
  }));
  return (
    <Select
      aria-label={LABEL}
      data={data}
      value={typeof value === "string" ? value : null}
      onChange={(v) => onChange(v ?? "")}
      searchable
    />
  );
}

// Renders the value input that matches the property type. is_empty / is_not_empty
// ops compare against nothing, so the widget is hidden for them. The emitted
// value is the raw comparison value (not the tagged {type,value} cell shape).
export function FilterValueWidget({
  property,
  op,
  value,
  onChange,
}: FilterValueWidgetProps) {
  const { t } = useTranslation();

  if (!opNeedsValue(op)) return null;

  switch (property.type) {
    case "number":
      return (
        <NumberInput
          aria-label={LABEL}
          value={typeof value === "number" ? value : ""}
          onChange={(v) => onChange(typeof v === "number" ? v : Number(v))}
        />
      );
    case "date":
      return (
        <DateInput
          aria-label={LABEL}
          valueFormat="YYYY-MM-DD"
          value={typeof value === "string" && value ? value : null}
          onChange={(v) => onChange(v ?? "")}
        />
      );
    case "checkbox":
      return (
        <Switch
          aria-label={LABEL}
          checked={value === true}
          label={value === true ? t("Checked") : t("Unchecked")}
          onChange={(e) => onChange(e.currentTarget.checked)}
        />
      );
    case "select":
    case "multi_select": {
      const options = getOptions(property.config).map((o) => ({
        value: o.id,
        label: o.label,
      }));
      return (
        <Select
          aria-label={LABEL}
          data={options}
          value={typeof value === "string" ? value : null}
          onChange={(v) => onChange(v ?? "")}
          searchable
        />
      );
    }
    case "relation":
      return (
        <RelationValueWidget
          property={property}
          value={value}
          onChange={onChange}
        />
      );
    default:
      // text / url
      return (
        <TextInput
          aria-label={LABEL}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.currentTarget.value)}
        />
      );
  }
}

export default FilterValueWidget;
