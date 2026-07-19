import { useState } from "react";
import {
  Combobox,
  Group,
  Input,
  InputBase,
  NumberInput,
  Select,
  Switch,
  Text,
  TextInput,
  useCombobox,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { IconCheck } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import {
  FilterOp,
  IDatabaseProperty,
} from "@/features/database/types/database.types.ts";
import { getOptions } from "@/features/database/components/property/option-config.ts";
import {
  useDatabaseRowsQuery,
  useDefaultViewId,
} from "@/features/database/queries/database-query.ts";
import { useWorkspaceMembersQuery } from "@/features/workspace/queries/workspace-query.ts";
import { useEmbedHost } from "@/features/database/components/embed-host-context.tsx";
import { PageGlyph } from "@/features/database/components/table-view/cells/page-ref-chip.tsx";
import { opNeedsValue } from "./operators";
import { isThisPageRef } from "./self-ref.ts";

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
  const rowList = rows ?? [];
  const data = rowList.map((r) => ({
    value: r.row.id,
    label: r.row.title || "Untitled",
  }));
  // Look up each row by id so an option can show its page glyph (emoji, or the
  // default doc/database icon) — the same PageGlyph the relation cell/picker
  // uses, so a relation filter option reads like a page block.
  const rowById = new Map(rowList.map((r) => [r.row.id, r.row]));
  return (
    <Select
      aria-label={LABEL}
      data={data}
      value={typeof value === "string" ? value : null}
      onChange={(v) => onChange(v ?? "")}
      searchable
      size="xs"
      renderOption={({ option }) => {
        const row = rowById.get(option.value);
        return (
          <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
            <PageGlyph
              icon={row?.icon ?? null}
              pageType={(row as { pageType?: string } | undefined)?.pageType}
            />
            <Text size="xs" lineClamp={1}>
              {option.label}
            </Text>
          </Group>
        );
      }}
    />
  );
}

// Picker over the workspace members for a person filter. Single-select: the raw
// comparison value is one user id ("contains <id>"), mirroring how the server
// matches a person array against one id — the same shape RelationValueWidget
// emits. Rendered with a low-level Combobox (not a plain Select) so the picked
// member shows as an avatar + name INSIDE the input — the same avatar treatment
// as PersonCell, which a Select's text-only input cannot do. The member list is
// fetched once and filtered client-side, so a large workspace (>100) may not
// surface every member (acceptable first cut, same limit as PersonCell).
// Intentionally does NOT import PersonCell or any ee/base grid code: this is a
// standalone filter widget that only reuses the shared CustomAvatar.
function PersonValueWidget({
  value,
  onChange,
}: Omit<FilterValueWidgetProps, "op" | "property">) {
  const { t } = useTranslation();
  const { data: members } = useWorkspaceMembersQuery({ limit: 100 });
  const [search, setSearch] = useState("");
  const combobox = useCombobox({ onDropdownClose: () => setSearch("") });

  const users = members?.items ?? [];
  const selectedId = typeof value === "string" && value ? value : null;
  const selected = users.find((u) => u.id === selectedId);
  const filtered = users.filter((u) =>
    `${u.name ?? ""} ${u.email ?? ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );

  return (
    <Combobox
      store={combobox}
      // The filter builder Popover closes on outside clicks, so keep the
      // dropdown inside it (same reasoning as SelfRefRelationValueWidget).
      withinPortal={false}
      onOptionSubmit={(val) => {
        onChange(val);
        combobox.closeDropdown();
      }}
    >
      <Combobox.Target>
        <InputBase
          component="button"
          type="button"
          size="xs"
          pointer
          w={170}
          aria-label={LABEL}
          rightSection={<Combobox.Chevron size="xs" />}
          rightSectionPointerEvents="none"
          onClick={() => combobox.toggleDropdown()}
        >
          {selected ? (
            <Group gap={6} wrap="nowrap">
              <CustomAvatar
                avatarUrl={selected.avatarUrl}
                name={selected.name ?? "?"}
                size={18}
              />
              <Text size="xs" lineClamp={1}>
                {selected.name ?? selected.email ?? t("Unknown")}
              </Text>
            </Group>
          ) : (
            <Input.Placeholder>{t("Select")}</Input.Placeholder>
          )}
        </InputBase>
      </Combobox.Target>
      <Combobox.Dropdown>
        <Combobox.Search
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          placeholder={t("Search...")}
        />
        <Combobox.Options>
          {filtered.length === 0 && (
            <Combobox.Empty>{t("No members found")}</Combobox.Empty>
          )}
          {filtered.map((u) => (
            <Combobox.Option value={u.id} key={u.id}>
              <Group gap="xs" justify="space-between" wrap="nowrap">
                <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                  <CustomAvatar
                    avatarUrl={u.avatarUrl}
                    name={u.name ?? "?"}
                    size={22}
                  />
                  <div style={{ minWidth: 0 }}>
                    <Text size="sm" lineClamp={1}>
                      {u.name}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {u.email}
                    </Text>
                  </div>
                </Group>
                {selectedId === u.id && <IconCheck size={16} stroke={2} />}
              </Group>
            </Combobox.Option>
          ))}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}

// Inside an embedded view (an embed has a host page), a relation filter can
// compare against "this page" — the host — instead of a fixed page. The symbol
// { thisPage: true } is stored and resolved to the host page id at render time
// (live self-reference). A kind toggle switches between the page picker and it.
function SelfRefRelationValueWidget({
  property,
  value,
  onChange,
}: Omit<FilterValueWidgetProps, "op">) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"page" | "this">(
    isThisPageRef(value) ? "this" : "page",
  );
  return (
    <Group gap="xs" wrap="nowrap" align="center">
      <Select
        aria-label={t("Filter value kind")}
        data={[
          { value: "page", label: t("Specific page") },
          { value: "this", label: t("This page") },
        ]}
        value={mode}
        onChange={(v) => {
          const next = v === "this" ? "this" : "page";
          setMode(next);
          // Reset the comparison value when switching kinds so a stale page id
          // or symbol never lingers across modes.
          onChange(next === "this" ? { thisPage: true } : "");
        }}
        allowDeselect={false}
        // The filter builder Popover closes on outside clicks, so value widgets
        // must keep their dropdowns inside it (withinPortal: false).
        comboboxProps={{ withinPortal: false }}
        size="xs"
        w={160}
      />
      {mode === "page" && (
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
  // An embed exposes its host page here; relation filters then offer a live
  // "this page" reference. Null on the database's own page (no host).
  const embedHost = useEmbedHost();

  if (!opNeedsValue(op)) return null;

  switch (property.type) {
    case "number":
      return (
        <NumberInput
          aria-label={LABEL}
          size="xs"
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
          size="xs"
          valueFormat="YYYY-MM-DD"
          value={typeof value === "string" && value ? value : null}
          onChange={(v) => onChange(v ?? "")}
        />
      );
    case "checkbox":
      return (
        <Switch
          aria-label={LABEL}
          size="xs"
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
          size="xs"
        />
      );
    }
    case "person":
      return <PersonValueWidget value={value} onChange={onChange} />;
    case "relation":
      return embedHost?.hostPageId ? (
        <SelfRefRelationValueWidget
          property={property}
          value={value}
          onChange={onChange}
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
          size="xs"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.currentTarget.value)}
        />
      );
  }
}

export default FilterValueWidget;
