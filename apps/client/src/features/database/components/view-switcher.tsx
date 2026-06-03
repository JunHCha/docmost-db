import { useState } from "react";
import { Group, Menu, ActionIcon, TextInput, UnstyledButton } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { IDatabaseView } from "@/features/database/types/database.types.ts";
import {
  useCreateViewMutation,
  useDeleteViewMutation,
  useSetDefaultViewMutation,
  useUpdateViewMutation,
} from "@/features/database/queries/database-query.ts";

interface ViewSwitcherProps {
  databaseId: string;
  views: IDatabaseView[];
  activeViewId: string;
  onActivate: (viewId: string) => void;
}

interface ViewTabProps {
  view: IDatabaseView;
  active: boolean;
  // Deleting the last view is blocked server-side, so the menu hides Delete
  // when only one view remains.
  canDelete: boolean;
  onActivate: () => void;
  onRename: (name: string) => void;
  onSetDefault: () => void;
  onDelete: () => void;
}

function ViewTab({
  view,
  active,
  canDelete,
  onActivate,
  onRename,
  onSetDefault,
  onDelete,
}: ViewTabProps) {
  const { t } = useTranslation();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(view.name);

  function commit() {
    setRenaming(false);
    const next = draft.trim();
    if (next && next !== view.name) onRename(next);
  }

  if (renaming) {
    return (
      <TextInput
        autoFocus
        size="xs"
        variant="default"
        value={draft}
        aria-label={t("Rename view")}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setRenaming(false);
        }}
      />
    );
  }

  return (
    <Group gap={2} wrap="nowrap">
      <UnstyledButton
        aria-label={`${t("View")} ${view.name}`}
        data-active={active}
        onClick={onActivate}
        style={{
          fontSize: "var(--mantine-font-size-sm)",
          fontWeight: active ? 600 : 400,
          padding: "2px 6px",
          borderBottom: active
            ? "2px solid var(--mantine-color-blue-5)"
            : "2px solid transparent",
        }}
      >
        {view.name}
      </UnstyledButton>
      <Menu position="bottom-start" transitionProps={{ duration: 0 }}>
        <Menu.Target>
          <ActionIcon
            size="xs"
            variant="subtle"
            aria-label={`${t("View")} ${view.name} ${t("options")}`}
          >
            ⋯
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            onClick={() => {
              setDraft(view.name);
              setRenaming(true);
            }}
          >
            {t("Rename")}
          </Menu.Item>
          {!view.isDefault && (
            <Menu.Item onClick={onSetDefault}>{t("Set as default")}</Menu.Item>
          )}
          {canDelete && (
            <>
              <Menu.Divider />
              <Menu.Item color="red" onClick={onDelete}>
                {t("Delete")}
              </Menu.Item>
            </>
          )}
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}

export function ViewSwitcher({
  databaseId,
  views,
  activeViewId,
  onActivate,
}: ViewSwitcherProps) {
  const { t } = useTranslation();
  const createView = useCreateViewMutation(databaseId);
  const updateView = useUpdateViewMutation(databaseId);
  const setDefault = useSetDefaultViewMutation(databaseId);
  const deleteView = useDeleteViewMutation(databaseId);

  return (
    <Group gap="xs" wrap="nowrap">
      {views.map((view) => (
        <ViewTab
          key={view.id}
          view={view}
          active={view.id === activeViewId}
          canDelete={views.length > 1}
          onActivate={() => onActivate(view.id)}
          onRename={(name) => updateView.mutate({ viewId: view.id, name })}
          onSetDefault={() => setDefault.mutate({ viewId: view.id })}
          onDelete={() => deleteView.mutate({ viewId: view.id })}
        />
      ))}
      <ActionIcon
        size="sm"
        variant="subtle"
        aria-label={t("Add view")}
        onClick={() =>
          createView.mutate({ databaseId, name: t("Grid"), type: "grid" })
        }
      >
        +
      </ActionIcon>
    </Group>
  );
}

export default ViewSwitcher;
