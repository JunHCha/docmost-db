import { useState } from "react";
import {
  Combobox,
  Group,
  Text,
  UnstyledButton,
  useCombobox,
} from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  useClearValueMutation,
  useDatabaseRowsQuery,
  useDefaultViewId,
  useSetValueMutation,
} from "@/features/database/queries/database-query.ts";
import { OptionPill } from "@/features/database/components/property/option-pill.tsx";
import { CellProps } from "./cell-props";
import { INLINE_EMPTY_PLACEHOLDER } from "./inline-text";

export function RelationCell({
  property,
  value,
  pageId,
  databaseId,
  showEmptyPlaceholder,
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
  const titleById = new Map(
    (rows ?? []).map((r) => [r.row.id, r.row.title ?? ""]),
  );

  function commit(ids: string[]) {
    const unique = [...new Set(ids)];
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
      withinPortal={false}
      onOptionSubmit={(val) => toggle(val)}
    >
      <Combobox.Target>
        <UnstyledButton
          aria-label={property.name}
          onClick={() => combobox.toggleDropdown()}
          style={{ width: "100%", minHeight: 20, textAlign: "left" }}
        >
          <Group gap={4} wrap="wrap">
            {selectedIds.length === 0
              ? // Empty relation: the button already spans the cell so it is
                // clickable, but the panel needs a visible hint to read as
                // editable (#93 follow-up). Grid leaves it blank to avoid noise.
                showEmptyPlaceholder && (
                  <Text size="xs" c="dimmed" style={{ fontStyle: "italic" }}>
                    {t(INLINE_EMPTY_PLACEHOLDER)}
                  </Text>
                )
              : selectedIds.map((id) =>
                  titleById.has(id) ? (
                    <OptionPill
                      key={id}
                      color="gray"
                      label={titleById.get(id) || "Untitled"}
                    />
                  ) : (
                    // The referenced row was deleted; show a placeholder instead
                    // of crashing. Dangling-reference cleanup is out of scope (#20).
                    <Text key={id} size="xs" c="dimmed">
                      (deleted)
                    </Text>
                  ),
                )}
          </Group>
        </UnstyledButton>
      </Combobox.Target>
      <Combobox.Dropdown>
        <Combobox.Search
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          placeholder="Search..."
        />
        <Combobox.Options>
          {opened &&
            filtered.map((r) => (
              <Combobox.Option value={r.row.id} key={r.row.id}>
                <Group gap="xs" justify="space-between" wrap="nowrap">
                  <OptionPill
                    color="gray"
                    label={r.row.title || "Untitled"}
                  />
                  {selectedIds.includes(r.row.id) && (
                    <Text size="xs" c="dimmed">
                      ✓
                    </Text>
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
