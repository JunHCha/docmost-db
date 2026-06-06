import { useMemo, useState } from "react";
import { Center, Loader, Stack, Text, TextInput } from "@mantine/core";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IPage } from "@/features/page/types/page.types.ts";
import {
  useDatabaseInfoQuery,
  useDatabasePropertiesQuery,
  useDatabaseRowsQuery,
  useDatabaseViewsQuery,
} from "@/features/database/queries/database-query.ts";
import { useUpdatePageMutation } from "@/features/page/queries/page-query.ts";
import { TableView } from "./table-view/table-view";
import { BoardView } from "./board-view/board-view";
import { ViewSwitcher } from "./view-switcher";

interface DatabaseViewContainerProps {
  page: IPage;
}

export function DatabaseViewContainer({ page }: DatabaseViewContainerProps) {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const infoQuery = useDatabaseInfoQuery(page.id);
  const databaseId = infoQuery.data?.database?.id ?? "";
  const propertiesQuery = useDatabasePropertiesQuery(databaseId);
  const viewsQuery = useDatabaseViewsQuery(databaseId);
  const views = useMemo(() => viewsQuery.data ?? [], [viewsQuery.data]);
  const updatePage = useUpdatePageMutation();
  const [titleDraft, setTitleDraft] = useState(page.title ?? "");

  // Local active-view selection. Resolve against the live list every render so
  // a deleted (or not-yet-chosen) active view falls back to the default/first
  // view rather than querying a dead view id.
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null);
  const activeView =
    views.find((v) => v.id === selectedViewId) ??
    views.find((v) => v.isDefault) ??
    views[0];
  const activeViewId = activeView?.id ?? "";
  const rowsQuery = useDatabaseRowsQuery(databaseId, activeViewId);

  function commitTitle() {
    const next = titleDraft.trim();
    if (next && next !== page.title) {
      updatePage.mutate({ pageId: page.id, title: next });
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

  if (propertiesQuery.isLoading || rowsQuery.isLoading || !activeView) {
    return (
      <Center p="xl">
        <Loader />
      </Center>
    );
  }

  return (
    <Stack p="md" gap="xs">
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
      <ViewSwitcher
        databaseId={databaseId}
        views={views}
        activeViewId={activeViewId}
        onActivate={setSelectedViewId}
      />
      {activeView.type === "board" ? (
        <BoardView
          databaseId={databaseId}
          properties={propertiesQuery.data ?? []}
          rows={rowsQuery.data ?? []}
          activeView={activeView}
          spaceSlug={spaceSlug}
        />
      ) : (
        <TableView
          databaseId={databaseId}
          spaceId={infoQuery.data?.database.spaceId ?? ""}
          properties={propertiesQuery.data ?? []}
          rows={rowsQuery.data ?? []}
          activeView={activeView}
          spaceSlug={spaceSlug}
        />
      )}
    </Stack>
  );
}

export default DatabaseViewContainer;
