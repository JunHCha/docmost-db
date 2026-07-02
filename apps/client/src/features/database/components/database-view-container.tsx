import { useMemo, useState } from "react";
import { Center, Loader, Stack, Text, TextInput } from "@mantine/core";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IPage } from "@/features/page/types/page.types.ts";
import { useDatabaseInfoQuery } from "@/features/database/queries/database-query.ts";
import { useUpdatePageMutation } from "@/features/page/queries/page-query.ts";
import { useQueryEmit } from "@/features/websocket/use-query-emit.ts";
import { UpdateEvent } from "@/features/websocket/types";
import localEmitter from "@/lib/local-emitter.ts";
import { useDatabaseCollab } from "../hooks/use-database-collab";
import { useDatabaseRealtime } from "../hooks/use-database-realtime";
import { DatabaseCollabContext } from "../hooks/database-collab-context";
import { DatabaseView } from "./database-view";
import { PageIcon } from "@/features/page/components/page-icon.tsx";

interface DatabaseViewContainerProps {
  page: IPage;
}

/**
 * Page-level chrome for a database page: the editable title plus the
 * page -> database resolution. The reusable body lives in DatabaseView; this
 * wrapper only handles the concerns specific to viewing a database as its own
 * page (title editing, info lookup by page id, route-derived space).
 */
export function DatabaseViewContainer({ page }: DatabaseViewContainerProps) {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const infoQuery = useDatabaseInfoQuery(page.id);
  const database = infoQuery.data?.database;
  const databaseId = database?.id ?? "";
  const updatePage = useUpdatePageMutation();
  const emit = useQueryEmit();
  const [titleDraft, setTitleDraft] = useState(page.title ?? "");

  // Open the DB view collaboration channel (presence/transport, #55) once this
  // page resolves to an actual database. Plain pages pass "" so the hook stays
  // disconnected. The collab doc reuses the DB page id, so the existing
  // page-permission auth applies unchanged.
  const { provider, onlineUsers, editingByCell, setEditingCell } =
    useDatabaseCollab(databaseId ? page.id : "");
  // Phase 2/3: propagate cell/row edits over that channel. broadcastChange is
  // handed to cell mutations via context below; Phase 4 also surfaces presence
  // (online users + who is editing which cell).
  const { broadcastChange } = useDatabaseRealtime(provider, databaseId);
  const collabValue = useMemo(
    () => ({ broadcastChange, onlineUsers, editingByCell, setEditingCell }),
    [broadcastChange, onlineUsers, editingByCell, setEditingCell],
  );

  function commitTitle() {
    const next = titleDraft.trim();
    if (next && next !== page.title) {
      updatePage.mutateAsync({ pageId: page.id, title: next }).then((updated) => {
        const event: UpdateEvent = {
          operation: "updateOne",
          spaceId: updated.spaceId,
          entity: ["pages"],
          id: updated.id,
          payload: {
            title: updated.title,
            slugId: updated.slugId,
            parentPageId: updated.parentPageId,
            icon: updated.icon,
          },
        };
        localEmitter.emit("message", event);
        emit(event);
      });
    }
  }

  if (infoQuery.isLoading) {
    return (
      <Center p="xl">
        <Loader />
      </Center>
    );
  }

  // info resolved but the page carries no database (the server returns
  // database: null for plain pages). Render a notice instead of hanging on a
  // loader that would never resolve.
  if (!databaseId) {
    return (
      <Stack p="md">
        <Text c="dimmed">{t("This page is not a database")}</Text>
      </Stack>
    );
  }

  if (infoQuery.isError) {
    return (
      <Stack p="md">
        <Text c="red">{t("Failed to load database")}</Text>
      </Stack>
    );
  }

  return (
    <DatabaseCollabContext.Provider value={collabValue}>
      {/* Top padding clears the fixed 45px page header (position: fixed) — the
          doc editor uses a 48px top margin for the same reason; without it the
          icon above the title is clipped by the header. */}
      <Stack px="md" pb="md" pt={56} gap="xs">
        <PageIcon
          pageId={page.id}
          spaceId={database?.spaceId ?? page.spaceId}
          icon={page.icon}
          pageType="database"
          editable={page.permissions?.canEdit ?? true}
        />
        <TextInput
          variant="unstyled"
          size="xl"
          fw={700}
          value={titleDraft}
          aria-label={t("Database title")}
          placeholder={t("Untitled")}
          onChange={(e) => setTitleDraft(e.currentTarget.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <DatabaseView
          databaseId={databaseId}
          spaceId={database?.spaceId ?? ""}
          spaceSlug={spaceSlug}
        />
      </Stack>
    </DatabaseCollabContext.Provider>
  );
}

export default DatabaseViewContainer;
