import { useState } from "react";
import { Combobox, Group, Text, useCombobox } from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  useClearValueMutation,
  useDatabaseRowsQuery,
  useDefaultViewId,
  useSetValueMutation,
} from "@/features/database/queries/database-query.ts";
import { IconCheck } from "@tabler/icons-react";
import { PageRefChip, PageGlyph } from "./page-ref-chip";
import { CellProps } from "./cell-props";
import { INLINE_EMPTY_PLACEHOLDER } from "./inline-text";

export function RelationCell({
  property,
  value,
  pageId,
  databaseId,
  showEmptyPlaceholder,
  onChange,
}: CellProps) {
  const { t } = useTranslation();
  const targetDatabaseId =
    typeof property.config?.targetDatabaseId === "string"
      ? property.config.targetDatabaseId
      : "";
  const setValue = useSetValueMutation(databaseId);
  const clearValue = useClearValueMutation(databaseId);
  const targetViewId = useDefaultViewId(targetDatabaseId);
  const { data: rows } = useDatabaseRowsQuery(targetDatabaseId, targetViewId);
  const [opened, setOpened] = useState(false);
  const combobox = useCombobox({
    opened,
    onDropdownClose: () => {
      setOpened(false);
      setSearch("");
    },
    onDropdownOpen: () => setOpened(true),
  });
  const [search, setSearch] = useState("");

  const selectedIds: string[] = Array.isArray(value?.value)
    ? (value!.value as string[])
    : [];
  const rowById = new Map((rows ?? []).map((r) => [r.row.id, r.row]));

  function commit(ids: string[]) {
    const unique = [...new Set(ids)];
    if (onChange) {
      onChange(
        unique.length === 0
          ? undefined
          : { type: "relation", value: unique },
      );
      return;
    }
    if (unique.length === 0) {
      clearValue.mutate({ pageId, propertyId: property.id });
      return;
    }
    setValue.mutate({
      pageId,
      propertyId: property.id,
      value: { type: "relation", value: unique },
    });
  }

  function toggle(id: string) {
    setSearch("");
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    commit(next);
  }

  const filtered = (rows ?? []).filter((r) =>
    (r.row.title ?? "")
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );

  return (
    <Combobox
      store={combobox}
      // Always portal: inline, the dropdown is clipped by the grid's vertical
      // overflow (table height) and by the row panel's overflow:hidden value
      // wrapper. A fixed width keeps page titles readable even when the cell /
      // column is narrow (the default "target" width would clip them) (#94).
      withinPortal
      width={280}
      position="bottom-start"
      onOptionSubmit={(val) => toggle(val)}
    >
      <Combobox.Target>
        {/* A div (not a button) so the page chips can nest their own open-icon
            buttons. Clicking anywhere here that isn't an open-icon (incl. a
            chip title) opens the relation picker; the chip icons stop
            propagation and open the peek instead. */}
        <div
          role="button"
          tabIndex={0}
          aria-label={property.name}
          onClick={() => combobox.toggleDropdown()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              combobox.toggleDropdown();
            }
          }}
          style={{ width: "100%", minHeight: 20, textAlign: "left", cursor: "pointer" }}
        >
          <Group gap={4} wrap="wrap">
            {selectedIds.length === 0
              ? // Empty relation: the target already spans the cell so it is
                // clickable, but the panel needs a visible hint to read as
                // editable (#93 follow-up). Grid leaves it blank to avoid noise.
                showEmptyPlaceholder && (
                  <Text size="xs" c="dimmed" style={{ fontStyle: "italic" }}>
                    {t(INLINE_EMPTY_PLACEHOLDER)}
                  </Text>
                )
              : selectedIds.map((id) => {
                  const row = rowById.get(id);
                  if (!row) {
                    // The referenced row was deleted; show a placeholder instead
                    // of crashing. Dangling-reference cleanup is out of scope (#20).
                    return (
                      <Text key={id} size="xs" c="dimmed">
                        (deleted)
                      </Text>
                    );
                  }
                  return (
                    <PageRefChip
                      key={id}
                      pageId={id}
                      title={row.title || "Untitled"}
                      icon={row.icon}
                      pageType={(row as { pageType?: string }).pageType}
                    />
                  );
                })}
          </Group>
        </div>
      </Combobox.Target>
      <Combobox.Dropdown>
        <Combobox.Search
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          placeholder="Search..."
        />
        <Combobox.Options>
          {opened && filtered.length === 0 && (
            <Combobox.Empty>No pages found</Combobox.Empty>
          )}
          {opened &&
            filtered.map((r) => (
              <Combobox.Option value={r.row.id} key={r.row.id}>
                <Group gap="xs" justify="space-between" wrap="nowrap">
                  <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                    <PageGlyph
                      icon={r.row.icon}
                      pageType={(r.row as { pageType?: string }).pageType}
                    />
                    <Text size="sm" lineClamp={1}>
                      {r.row.title || "Untitled"}
                    </Text>
                  </Group>
                  {selectedIds.includes(r.row.id) && (
                    <IconCheck size={16} stroke={2} />
                  )}
                </Group>
              </Combobox.Option>
            ))}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}

export default RelationCell;
