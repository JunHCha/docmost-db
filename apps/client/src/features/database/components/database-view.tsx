import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Center, Group, Loader, Stack, Text } from "@mantine/core";
import { useDebouncedCallback } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import {
  IFilterCondition,
  ISortCondition,
} from "@/features/database/types/database.types.ts";
import {
  useDatabasePropertiesQuery,
  useDatabaseRowsQuery,
  useDatabaseViewsQuery,
  useUpdateViewMutation,
} from "@/features/database/queries/database-query.ts";
import { TableView } from "./table-view/table-view";
import { BoardView } from "./board-view/board-view";
import { ViewSwitcher } from "./view-switcher";
import { ViewToolbar } from "./toolbar/view-toolbar";

const PERSIST_DEBOUNCE_MS = 400;

interface DatabaseViewProps {
  // Mount by raw identifiers rather than an IPage so the same body can render
  // both the database page (via DatabaseViewContainer) and an inline embed
  // (issue #24), which only carries databaseId/viewId and resolves its host
  // space independently of the current route.
  databaseId: string;
  spaceId: string;
  spaceSlug?: string;
}

/**
 * Reusable database body: view tabs + filter/sort toolbar + the active table or
 * board view. Owns the active-view selection and the working copy of
 * filters/sorts, but knows nothing about pages, titles, or the route. Callers
 * resolve databaseId/spaceId/spaceSlug however they like and hand them in.
 */
export function DatabaseView({
  databaseId,
  spaceId,
  spaceSlug,
}: DatabaseViewProps) {
  const { t } = useTranslation();
  const propertiesQuery = useDatabasePropertiesQuery(databaseId);
  const viewsQuery = useDatabaseViewsQuery(databaseId);
  const views = useMemo(() => viewsQuery.data ?? [], [viewsQuery.data]);

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
        config: {
          ...activeView.config,
          filters: nextFilters,
          sorts: nextSorts,
        },
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

  if (propertiesQuery.isLoading || rowsQuery.isLoading || !activeView) {
    return (
      <Center p="xl">
        <Loader />
      </Center>
    );
  }

  return (
    <Stack gap="xs">
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
          spaceId={spaceId}
          properties={propertiesQuery.data ?? []}
          rows={rowsQuery.data ?? []}
          activeView={activeView}
          spaceSlug={spaceSlug}
        />
      )}
    </Stack>
  );
}

export default DatabaseView;
