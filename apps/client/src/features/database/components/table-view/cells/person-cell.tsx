import { useState } from "react";
import { Combobox, Group, Text, useCombobox } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { IconCheck } from "@tabler/icons-react";
import {
  useClearValueMutation,
  useSetValueMutation,
} from "@/features/database/queries/database-query.ts";
import { useWorkspaceMembersQuery } from "@/features/workspace/queries/workspace-query.ts";
import { IUser } from "@/features/user/types/user.types.ts";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { CellProps } from "./cell-props";
import { INLINE_EMPTY_PLACEHOLDER } from "./inline-text";

// Multi-person cell: stores an array of workspace user ids (mirrors relation's
// value shape). The member list is fetched once and filtered client-side, so
// selected chips resolve even before the user searches (same approach as
// RelationCell over target rows). Large workspaces (>100 members) may not
// resolve every id — acceptable for a first cut.
export function PersonCell({
  property,
  value,
  pageId,
  databaseId,
  showEmptyPlaceholder,
  onChange,
}: CellProps) {
  const { t } = useTranslation();
  const setValue = useSetValueMutation(databaseId);
  const clearValue = useClearValueMutation(databaseId);
  const { data: members } = useWorkspaceMembersQuery({ limit: 100 });
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
  const users: IUser[] = members?.items ?? [];
  const userById = new Map(users.map((u) => [u.id, u]));

  function commit(ids: string[]) {
    const unique = [...new Set(ids)];
    if (onChange) {
      onChange(
        unique.length === 0 ? undefined : { type: "person", value: unique },
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
      value: { type: "person", value: unique },
    });
  }

  function toggle(id: string) {
    setSearch("");
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    commit(next);
  }

  const filtered = users.filter((u) =>
    `${u.name ?? ""} ${u.email ?? ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );

  return (
    <Combobox
      store={combobox}
      withinPortal
      width={280}
      position="bottom-start"
      onOptionSubmit={(val) => toggle(val)}
    >
      <Combobox.Target>
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
          style={{
            width: "100%",
            minHeight: 20,
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <Group gap={4} wrap="wrap">
            {selectedIds.length === 0
              ? showEmptyPlaceholder && (
                  <Text size="xs" c="dimmed" style={{ fontStyle: "italic" }}>
                    {t(INLINE_EMPTY_PLACEHOLDER)}
                  </Text>
                )
              : selectedIds.map((id) => {
                  const user = userById.get(id);
                  return (
                    <Group key={id} gap={4} wrap="nowrap">
                      <CustomAvatar
                        avatarUrl={user?.avatarUrl}
                        name={user?.name ?? "?"}
                        size={18}
                      />
                      <Text size="xs" lineClamp={1}>
                        {user?.name ?? t("Unknown")}
                      </Text>
                    </Group>
                  );
                })}
          </Group>
        </div>
      </Combobox.Target>
      <Combobox.Dropdown>
        <Combobox.Search
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          placeholder={t("Search...")}
        />
        <Combobox.Options>
          {opened && filtered.length === 0 && (
            <Combobox.Empty>{t("No members found")}</Combobox.Empty>
          )}
          {opened &&
            filtered.map((u) => (
              <Combobox.Option value={u.id} key={u.id}>
                <Group gap="xs" justify="space-between" wrap="nowrap">
                  <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                    <CustomAvatar
                      avatarUrl={u.avatarUrl}
                      name={u.name}
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
                  {selectedIds.includes(u.id) && (
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

export default PersonCell;
