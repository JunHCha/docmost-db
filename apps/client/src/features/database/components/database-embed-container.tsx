import { useMemo, useRef, useState } from "react";
import {
  Button,
  Center,
  Group,
  Loader,
  Stack,
  Text,
} from "@mantine/core";
import { useDebouncedCallback } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
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
import { TableView } from "./table-view/table-view";
import { BoardView } from "./board-view/board-view";
import { ViewSwitcher } from "./view-switcher";
import { ViewToolbar } from "./toolbar/view-toolbar";

const PERSIST_DEBOUNCE_MS = 400;

interface DatabaseEmbedContainerProps {
  // The page id of the database page (not the databaseId — the host editor
  // carries the page id stored in the databaseView node attr).
  pageId: string;
  // Initial view to activate. Falls back to the default / first view.
  initialViewId?: string | null;
  // Slug of the host document's space (from the editor's route params).
  spaceSlug?: string;
}

/**
 * Lightweight read/edit container for a database embedded inside a document.
 *
 * Intentionally omits the title TextInput present in `DatabaseViewContainer`
 * (the full-page variant) — the embed header shows the DB name as a static
 * label only. Filter/sort interactions are local to the embed instance and
 * are persisted back to the view's config via the same debounced updateView
 * path as the full-page container.
 */
export function DatabaseEmbedContainer({
  pageId,
  initialViewId,
  spaceSlug,
}: DatabaseEmbedContainerProps) {
  const { t } = useTranslation();
  const infoQuery = useDatabaseInfoQuery(pageId);
  const databaseId = infoQuery.data?.database?.id ?? "";
  const propertiesQuery = useDatabasePropertiesQuery(databaseId);
  const viewsQuery = useDatabaseViewsQuery(databaseId);
  const views = useMemo(() => viewsQuery.data ?? [], [viewsQuery.data]);

  // Seed the selected view from the initialViewId prop (the viewId stored in
  // the node attrs). Falls back to the default / first view via the same
  // logic as DatabaseViewContainer.
  const [selectedViewId, setSelectedViewId] = useState<string | null>(
    initialViewId ?? null,
  );
  const activeView =
    views.find((v) => v.id === selectedViewId) ??
    views.find((v) => v.isDefault) ??
    views[0];
  const activeViewId = activeView?.id ?? "";
  const updateView = useUpdateViewMutation(databaseId);

  const [filters, setFilters] = useState<IFilterCondition[]>([]);
  const [sorts, setSorts] = useState<ISortCondition[]>([]);
  const activeConfigRef = useRef(activeView?.config);
  activeConfigRef.current = activeView?.config;

  // Reseed filters/sorts only when the active view tab changes — identical
  // logic to DatabaseViewContainer to avoid mid-debounce clobber.
  const prevViewIdRef = useRef<string>("");
  if (prevViewIdRef.current !== activeViewId) {
    prevViewIdRef.current = activeViewId;
    setFilters(activeConfigRef.current?.filters ?? []);
    setSorts(activeConfigRef.current?.sorts ?? []);
  }

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

  if (infoQuery.isLoading) {
    return (
      <Center p="md">
        <Loader size="sm" />
      </Center>
    );
  }

  if (infoQuery.isError) {
    return (
      <Stack p="sm">
        <Text c="red" size="sm">
          {t("Failed to load database")}
        </Text>
      </Stack>
    );
  }

  if (!databaseId) {
    return (
      <Stack p="sm">
        <Text c="dimmed" size="sm">
          {t("This page is not a database")}
        </Text>
      </Stack>
    );
  }

  if (propertiesQuery.isLoading || rowsQuery.isLoading || !activeView) {
    return (
      <Center p="md">
        <Loader size="sm" />
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
        <Stack align="center" py="md" gap="xs">
          <Text c="dimmed" size="sm">
            {t("No rows match the current filters")}
          </Text>
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

export default DatabaseEmbedContainer;
