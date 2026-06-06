import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Center,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useDebouncedCallback } from "@mantine/hooks";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IPage } from "@/features/page/types/page.types.ts";
import {
  IFilterCondition,
  ISortCondition,
} from "@/features/database/types/database.types.ts";
import {
  useDatabaseInfoQuery,
  useDatabasePropertiesQuery,
  useDatabaseRowsQuery,
  useDatabaseViewsQuery,
  useUpdateViewMutation,
} from "@/features/database/queries/database-query.ts";
import { useUpdatePageMutation } from "@/features/page/queries/page-query.ts";
import { TableView } from "./table-view/table-view";
import { BoardView } from "./board-view/board-view";
import { ViewSwitcher } from "./view-switcher";
import { ViewToolbar } from "./toolbar/view-toolbar";

const PERSIST_DEBOUNCE_MS = 400;

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
  const updateView = useUpdateViewMutation(databaseId);

  // Local working copy of the active view's filters/sorts. The rows query reads
  // it (so changes apply immediately) while a debounced updateView persists it
  // to database_views.config.
  const [filters, setFilters] = useState<IFilterCondition[]>([]);
  const [sorts, setSorts] = useState<ISortCondition[]>([]);
  // Reseed ONLY when the active view changes (tab switch), not when the active
  // view's config reference changes. updateView now patches the views cache in
  // place, but even a server echo of the just-saved config would otherwise
  // retrigger this effect mid-debounce and clobber the user's in-flight edit
  // with a stale snapshot. The config is read through a ref so it is current at
  // reseed time without being an effect dependency.
  const activeConfigRef = useRef(activeView?.config);
  activeConfigRef.current = activeView?.config;
  useEffect(() => {
    setFilters(activeConfigRef.current?.filters ?? []);
    setSorts(activeConfigRef.current?.sorts ?? []);
  }, [activeViewId]);

  const viewConfig = useMemo(
    () => (activeView ? { ...activeView.config, filters, sorts } : undefined),
    [activeView, filters, sorts],
  );
  const rowsQuery = useDatabaseRowsQuery(databaseId, activeViewId, viewConfig);

  const persistConfig = useDebouncedCallback(
    (nextFilters: IFilterCondition[], nextSorts: ISortCondition[]) => {
      if (!activeView) return;
      updateView.mutate({
        viewId: activeView.id,
        config: { ...activeView.config, filters: nextFilters, sorts: nextSorts },
      });
    },
    PERSIST_DEBOUNCE_MS,
  );

  function changeFilters(next: IFilterCondition[]) {
    setFilters(next);
    persistConfig(next, sorts);
  }

  function changeSorts(next: ISortCondition[]) {
    setSorts(next);
    persistConfig(filters, next);
  }

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
      <Group justify="space-between" align="center">
        <ViewSwitcher
          databaseId={databaseId}
          views={views}
          activeViewId={activeViewId}
          onActivate={setSelectedViewId}
        />
        <ViewToolbar
          properties={propertiesQuery.data ?? []}
          filters={filters}
          sorts={sorts}
          onFiltersChange={changeFilters}
          onSortsChange={changeSorts}
        />
      </Group>
      {activeView.type === "board" ? (
        <BoardView
          databaseId={databaseId}
          properties={propertiesQuery.data ?? []}
          rows={rowsQuery.data ?? []}
          activeView={activeView}
          spaceSlug={spaceSlug}
        />
      ) : !rowsQuery.isLoading &&
        (rowsQuery.data ?? []).length === 0 &&
        filters.length > 0 ? (
        // Filtered-empty state is table-only: the board groups rows into option
        // columns and stays useful when empty, and we gate on !isLoading so a
        // refetch (e.g. after a filter change) doesn't flash this notice.
        <Stack align="center" py="xl" gap="xs">
          <Text c="dimmed">{t("No rows match the current filters")}</Text>
          <Button variant="subtle" size="xs" onClick={() => changeFilters([])}>
            {t("Clear filters")}
          </Button>
        </Stack>
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
