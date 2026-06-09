import { useState } from "react";
import { Group, Menu, ActionIcon, TextInput, UnstyledButton } from "@mantine/core";
import { IconLock } from "@tabler/icons-react";
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
  // The embed scope (issue #39) new views belong to; undefined for the original
  // database. Forwarded to createView so a view is created in the right scope.
  embedId?: string;
  // Host page of an embed (issue #60). Sent on create so the new embed view
  // records its source_page_id for save-time orphan reconcile.
  pageId?: string;
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
  const [menuOpened, setMenuOpened] = useState(false);

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

  // Notion-style tab: clicking an inactive tab switches to it; clicking the
  // already-active tab opens its config menu. The menu is only allowed to open
  // while active, so the onChange guard ignores Mantine's toggle on inactive
  // tabs (where the click instead activates the view).
  return (
    <Menu
      opened={active && menuOpened}
      onChange={(o) => active && setMenuOpened(o)}
      position="bottom-start"
      transitionProps={{ duration: 0 }}
    >
      <Menu.Target>
        <UnstyledButton
          aria-label={`${t("View")} ${view.name}`}
          data-active={active}
          onClick={() => {
            if (!active) onActivate();
          }}
          style={{
            fontSize: "var(--mantine-font-size-sm)",
            fontWeight: active ? 600 : 400,
            padding: "2px 6px",
            borderBottom: active
              ? "2px solid var(--mantine-color-blue-5)"
              : "2px solid transparent",
          }}
        >
          {/* Personal views (issue #39: ownerUserId set) are visible only to
              their owner, so flag them with a lock to distinguish them from
              shared views in the same tab strip. */}
          {view.ownerUserId ? (
            <IconLock
              size={12}
              style={{ marginRight: 4, verticalAlign: "middle" }}
              aria-label={t("Personal view")}
            />
          ) : null}
          {view.name}
        </UnstyledButton>
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
  );
}

// The view types offered by the add-view menu, each created in both a shared
// and a personal variant below.
const VIEW_TYPES: { type: string; label: string }[] = [
  { type: "table", label: "Table" },
  { type: "board", label: "Board" },
  { type: "calendar", label: "Calendar" },
];

export function ViewSwitcher({
  databaseId,
  embedId,
  pageId,
  views,
  activeViewId,
  onActivate,
}: ViewSwitcherProps) {
  const { t } = useTranslation();
  const createView = useCreateViewMutation(databaseId, embedId);
  const updateView = useUpdateViewMutation(databaseId, embedId);
  const setDefault = useSetDefaultViewMutation(databaseId, embedId);
  const deleteView = useDeleteViewMutation(databaseId, embedId);

  function addView(type: string, visibility: "personal" | "shared") {
    createView.mutate({
      databaseId,
      name: t(VIEW_TYPES.find((v) => v.type === type)!.label),
      type,
      embedId,
      pageId,
      visibility,
    });
  }

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
      <Menu position="bottom-start" transitionProps={{ duration: 0 }}>
        <Menu.Target>
          <ActionIcon size="sm" variant="subtle" aria-label={t("Add view")}>
            +
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          {/* Shared views are visible to everyone with access; personal views
              (issue #39) are private to their creator. */}
          <Menu.Label>{t("Shared")}</Menu.Label>
          {VIEW_TYPES.map((v) => (
            <Menu.Item
              key={`shared-${v.type}`}
              onClick={() => addView(v.type, "shared")}
            >
              {t(v.label)}
            </Menu.Item>
          ))}
          <Menu.Divider />
          <Menu.Label>{t("Personal")}</Menu.Label>
          {VIEW_TYPES.map((v) => (
            <Menu.Item
              key={`personal-${v.type}`}
              leftSection={<IconLock size={14} />}
              onClick={() => addView(v.type, "personal")}
            >
              {t(v.label)}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}

export default ViewSwitcher;
