import { useState } from "react";
import { Group, NumberInput, Select, Switch, TextInput } from "@mantine/core";
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
import {
  TemplateEmbedContextValue,
  useTemplateEmbedContext,
} from "@/features/database/components/template-peek/template-embed-context.tsx";
import { opNeedsValue } from "./operators";
import { isTemplatePropertyRef } from "./template-property-ref.ts";

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

// Inside a template's embed view a relation filter can compare against either a
// concrete page or a *reference* to one of the template's own relation
// properties ({ templatePropertyRef }), snapshotted to the new row's value at
// creation (issue #115). A kind toggle switches between the page picker and a
// select over the template's relation properties.
function TemplateRelationValueWidget({
  property,
  value,
  onChange,
  ctx,
}: Omit<FilterValueWidgetProps, "op"> & {
  ctx: TemplateEmbedContextValue;
}) {
  const { t } = useTranslation();
  const refValue = isTemplatePropertyRef(value) ? value : null;
  const [mode, setMode] = useState<"page" | "ref">(refValue ? "ref" : "page");
  const refOptions = ctx.templateProperties
    .filter((p) => p.type === "relation")
    .map((p) => ({ value: p.id, label: p.name }));
  return (
    <Group gap="xs" wrap="nowrap" align="center">
      <Select
        aria-label={t("Filter value kind")}
        data={[
          { value: "page", label: t("Specific page") },
          { value: "ref", label: t("Template property reference") },
        ]}
        value={mode}
        onChange={(v) => {
          const next = v === "ref" ? "ref" : "page";
          setMode(next);
          // Reset the comparison value when switching kinds so a stale page id
          // or ref never lingers across modes.
          onChange(next === "ref" ? undefined : "");
        }}
        allowDeselect={false}
        comboboxProps={{ withinPortal: true }}
        w={180}
      />
      {mode === "ref" ? (
        <Select
          aria-label={t("Template property")}
          data={refOptions}
          value={refValue?.templatePropertyRef ?? null}
          onChange={(v) =>
            onChange(v ? { templatePropertyRef: v } : undefined)
          }
          comboboxProps={{ withinPortal: true }}
          searchable
        />
      ) : (
        <RelationValueWidget
          property={property}
          value={value}
          onChange={onChange}
        />
      )}
    </Group>
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
  // In a template editor an embedded view can reference template properties in
  // its relation filters; outside one this is null and behaviour is unchanged.
  const templateCtx = useTemplateEmbedContext();

  if (!opNeedsValue(op)) return null;

  switch (property.type) {
    case "number":
      return (
        <NumberInput
          aria-label={LABEL}
          value={typeof value === "number" ? value : ""}
          onChange={(v) => {
            // NumberInput emits "" while the field is empty; forward undefined
            // (not Number("") === 0) so an empty input never persists a spurious 0.
            if (v === "" || v === null || v === undefined) {
              onChange(undefined);
              return;
            }
            onChange(typeof v === "number" ? v : Number(v));
          }}
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
      return templateCtx ? (
        <TemplateRelationValueWidget
          property={property}
          value={value}
          onChange={onChange}
          ctx={templateCtx}
        />
      ) : (
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
