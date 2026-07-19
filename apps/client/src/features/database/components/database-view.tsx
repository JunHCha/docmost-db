import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Center, Group, Loader, Stack, Text } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import {
  IDatabaseViewConfig,
  IFilterCondition,
  ISortCondition,
} from "@/features/database/types/database.types.ts";
import {
  useDatabasePropertiesQuery,
  useDatabaseRowsQuery,
  useDatabaseViewsQuery,
  useUpdateViewMutation,
} from "@/features/database/queries/database-query.ts";
import {
  sanitizeFilters,
  sanitizeSorts,
} from "@/features/database/filters/sanitize.ts";
import { resolveSelfRefFilters } from "@/features/database/filters/self-ref.ts";
import { EmbedHostProvider } from "./embed-host-context.tsx";
import { echoColumns } from "./table-view/view-columns";
import { isDraftDirty, pruneUnknownPropertyRefs } from "./view-draft";
import { TableView } from "./table-view/table-view";
import { BoardView } from "./board-view/board-view";
import { CalendarView } from "./calendar-view/calendar-view";
import { ViewSwitcher } from "./view-switcher";
import { ViewToolbar } from "./toolbar/view-toolbar";
import { DatabasePresenceAvatars } from "./database-presence-avatars";
import { useDatabaseCollabPresence } from "../hooks/database-collab-context";
import { useEditingCellTracker } from "../hooks/use-editing-cell-tracker";

interface DatabaseViewProps {
  // Mount by raw identifiers rather than an IPage so the same body can render
  // both the database page (via DatabaseViewContainer) and an inline embed
  // (issue #24), which only carries databaseId/viewId and resolves its host
  // space independently of the current route.
  databaseId: string;
  spaceId: string;
  spaceSlug?: string;
  // The embed (issue #24) pins a specific view rather than always opening the
  // default; a deleted id still falls through to the default/first view below.
  initialViewId?: string;
  // The embed's own view scope (issue #39). When set, all view queries and
  // mutations target this scope's views rather than the original database's,
  // and edits persist there. Undefined => the original database scope
  // (DatabaseViewContainer), so its existing behaviour is unchanged.
  embedId?: string;
  // Host page id of an embed (issue #60). Threaded to view list/create so the
  // server can record source_page_id and reconcile orphan views on save.
  pageId?: string;
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
  initialViewId,
  embedId,
  pageId,
}: DatabaseViewProps) {
  const { t } = useTranslation();
  // Publish which cell the local user is editing so peers can highlight it
  // (#55 Phase 4). Scoped to this view's root so inline embeds don't collide.
  const rootRef = useRef<HTMLDivElement>(null);
  const { setEditingCell } = useDatabaseCollabPresence();
  useEditingCellTracker(rootRef, setEditingCell);
  const propertiesQuery = useDatabasePropertiesQuery(databaseId);
  const viewsQuery = useDatabaseViewsQuery(databaseId, embedId, pageId);
  const views = useMemo(() => viewsQuery.data ?? [], [viewsQuery.data]);

  // Local active-view selection. Resolve against the live list every render so
  // a deleted (or not-yet-chosen) active view falls back to the default/first
  // view rather than querying a dead view id.
  const [selectedViewId, setSelectedViewId] = useState<string | null>(
    initialViewId ?? null,
  );
  const activeView =
    views.find((v) => v.id === selectedViewId) ??
    views.find((v) => v.isDefault) ??
    views[0];
  const activeViewId = activeView?.id ?? "";
  const updateView = useUpdateViewMutation(databaseId, embedId);

  // Local DRAFT of the active view's full config. Every toolbar / column edit
  // mutates the draft only — the grid reads it so changes apply immediately —
  // and nothing is persisted until the user clicks "Save changes" (deferred
  // save, issue #92). No more debounced/immediate updateView on edit.
  const [draft, setDraft] = useState<IDatabaseViewConfig>(
    activeView?.config ?? {},
  );
  // Reseed the draft ONLY on a tab switch (activeViewId change) AND only when
  // the current draft is not dirty. A dirty draft is preserved across re-renders
  // and server echoes of the saved config, so an in-flight unsaved edit is never
  // clobbered. Saved config is read through a ref so it is current at reseed time
  // without being an effect dependency (which would retrigger on every echo).
  const savedConfigRef = useRef(activeView?.config);
  savedConfigRef.current = activeView?.config;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  // The saved config the current draft was seeded from, tagged with its view so
  // the remote-change effect below never compares across a tab switch. Only the
  // paths that (re)seed the draft move this anchor.
  //
  // Unsaved edits are deliberately VOLATILE: they live in React state only, so
  // a refresh or navigation drops them. Persisting drafts (localStorage) proved
  // fragile — stale restores after saves/deploys kept resurrecting phantom
  // "Save changes" prompts — so the survive-refresh scenario was retired.
  const seededConfigRef = useRef<{
    viewId: string;
    config: IDatabaseViewConfig;
  } | null>(null);
  useEffect(() => {
    // Tab switch / mount. Preserve the draft only when the USER dirtied it for
    // THIS view — i.e. it diverged from the config it was seeded from. Guarding
    // against the INCOMING saved config instead mistook the not-yet-seeded {}
    // for an unsaved edit whenever views resolved async (any hard refresh with
    // a cold cache) and never seeded, showing a phantom "Save changes" prompt.
    const seeded = seededConfigRef.current;
    if (
      seeded?.viewId === activeViewId &&
      isDraftDirty(draftRef.current, seeded.config)
    ) {
      return;
    }
    const saved = savedConfigRef.current ?? {};
    seededConfigRef.current = { viewId: activeViewId, config: saved };
    setDraft(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeViewId]);

  // Detect the saved config moving underneath a mounted view (another user's
  // save, or a normalised refetch echo). Without this, a clean draft kept its
  // old seed and the dirty flag flipped on even though the user edited nothing.
  const overwriteWarnedViewIdsRef = useRef(new Set<string>());
  useEffect(() => {
    const seeded = seededConfigRef.current;
    if (!activeView || !seeded || seeded.viewId !== activeView.id) return;
    const saved = activeView.config ?? {};
    if (!isDraftDirty(seeded.config, saved)) return; // no remote change
    const draftWasClean = !isDraftDirty(draftRef.current, seeded.config);
    seededConfigRef.current = { viewId: activeView.id, config: saved };
    if (!isDraftDirty(draftRef.current, saved)) return; // our own save echo
    if (draftWasClean) {
      // Nothing of the user's to lose — follow the server copy.
      setDraft(saved);
      notifications.show({
        message: t(
          "Someone edited this view. It has been updated to the latest version.",
        ),
        color: "blue",
      });
    } else if (!overwriteWarnedViewIdsRef.current.has(activeView.id)) {
      // Keep the unsaved edits, but say so once — not on every echo.
      overwriteWarnedViewIdsRef.current.add(activeView.id);
      notifications.show({
        message: t(
          "Someone edited this view. Saving will overwrite their changes.",
        ),
        color: "yellow",
      });
    }
  }, [activeView, t]);

  const filters = useMemo(() => draft.filters ?? [], [draft.filters]);
  const sorts = useMemo(() => draft.sorts ?? [], [draft.sorts]);
  const dirty = isDraftDirty(draft, activeView?.config);

  // The rows query gets a sanitized copy of the DRAFT: in-progress rows (an
  // added filter without a value yet) are dropped so they don't blank the grid.
  // The UI keeps the raw draft so the user's in-flight edit survives.
  const viewConfig = useMemo(
    () =>
      activeView
        ? {
            ...draft,
            // Resolve "this page" relation refs to the host page id so the rows
            // query receives a plain page id (live self-reference).
            filters: resolveSelfRefFilters(sanitizeFilters(filters), pageId),
            sorts: sanitizeSorts(sorts),
          }
        : undefined,
    [activeView, draft, filters, sorts, pageId],
  );
  // Debounce only the FILTERS that drive the rows query: a filter value typed
  // character-by-character would otherwise fire a request (and a refetch) per
  // keystroke, flickering the grid. Sorts/columns change by discrete clicks, so
  // they stay immediate (debouncing them would add lag for no benefit). The
  // toolbar/draft are always immediate; only the server query waits for typing.
  const [debouncedFilters] = useDebouncedValue(viewConfig?.filters, 250);
  const rowsQueryConfig = useMemo(
    () =>
      viewConfig ? { ...viewConfig, filters: debouncedFilters } : undefined,
    [viewConfig, debouncedFilters],
  );
  const rowsQuery = useDatabaseRowsQuery(
    databaseId,
    activeViewId,
    rowsQueryConfig,
  );

  // The active view as the grid should render it RIGHT NOW: the saved view with
  // the unsaved draft config layered on so column order/width/visibility and
  // groupBy/dateProperty preview immediately.
  const draftView = useMemo(
    () =>
      activeView
        ? {
            ...activeView,
            // The grid reads filters from here to seed a new "+ Row" so it
            // survives the view; resolve "this page" so a row added in an
            // embedded self-referencing view is linked back to the host page.
            config: {
              ...draft,
              filters: resolveSelfRefFilters(draft.filters ?? [], pageId),
            },
          }
        : activeView,
    [activeView, draft, pageId],
  );

  function changeFilters(next: IFilterCondition[]) {
    setDraft((d) => ({ ...d, filters: next }));
  }

  function changeSorts(next: ISortCondition[]) {
    setDraft((d) => ({ ...d, sorts: next }));
  }

  // Toggle a column's visibility — draft only.
  function toggleColumn(propertyId: string, visible: boolean) {
    setDraft((d) => ({
      ...d,
      columns: echoColumns(propertiesQuery.data ?? [], d.columns, {
        propertyId,
        visible,
      }),
    }));
  }

  // Resize a column — draft only.
  function resizeColumn(propertyId: string, width: number) {
    setDraft((d) => ({
      ...d,
      columns: echoColumns(propertiesQuery.data ?? [], d.columns, {
        propertyId,
        width,
      }),
    }));
  }

  // Resize the leading Title column — draft only (titleWidth lives on config).
  function resizeTitle(width: number) {
    setDraft((d) => ({ ...d, titleWidth: width }));
  }

  // Reorder columns by writing the new display order straight into the draft's
  // columns array, preserving each column's prior visibility/width. View-scoped
  // order (#92). We build it explicitly rather than via echoColumns because
  // echoColumns re-sorts by property.position when the config is still empty.
  function reorderColumns(orderedPropertyIds: string[]) {
    setDraft((d) => {
      const prior = new Map((d.columns ?? []).map((c) => [c.propertyId, c]));
      const columns = orderedPropertyIds.map((propertyId) => {
        const existing = prior.get(propertyId);
        return {
          propertyId,
          visible: existing?.visible ?? true,
          ...(existing?.width !== undefined ? { width: existing.width } : {}),
        };
      });
      return { ...d, columns };
    });
  }

  // Set/clear the board's group-by property — draft only.
  function changeGroupBy(id: string | null) {
    setDraft((d) => ({ ...d, groupByPropertyId: id ?? undefined }));
  }

  // Set/clear a calendar view's single date property — draft only.
  function changeDateProperty(id: string | null) {
    setDraft((d) => ({ ...d, datePropertyId: id ?? undefined }));
  }

  // Persist the whole draft on demand. Success leaves dirty=false because the
  // views cache then echoes this exact config (draft === saved). A failed save
  // keeps the dirty draft in memory (no echo arrives), so the user can retry or
  // Discard after the mutation's own error notice.
  function saveChanges() {
    if (!activeView || !dirty) return;
    // A peer may have deleted a property between the edit and Save; strip refs
    // to properties missing from the live list so the payload stays consistent
    // with the schema instead of persisting dead refs (or failing). Skipped
    // while the list hasn't loaded — no basis to prune against.
    const { config, dropped } = propertiesQuery.data
      ? pruneUnknownPropertyRefs(
          draft,
          new Set(propertiesQuery.data.map((p) => p.id)),
        )
      : { config: draft, dropped: false };
    if (dropped) {
      notifications.show({
        message: t(
          "Some changes referred to deleted properties and were left out.",
        ),
        color: "yellow",
      });
    }
    setDraft(config);
    updateView.mutate({ viewId: activeView.id, config });
  }

  // Discard unsaved edits back to the last saved config.
  function revertChanges() {
    setDraft(activeView?.config ?? {});
  }

  if (propertiesQuery.isLoading || rowsQuery.isLoading || !activeView || !draftView) {
    return (
      <Center p="xl">
        <Loader />
      </Center>
    );
  }

  return (
    // hostPageId lets relation filters offer a live "this page" reference,
    // resolved to this embed's host page (undefined on the database's own page).
    <EmbedHostProvider value={{ hostPageId: pageId }}>
    {/* data-database-grid marks the whole grid as owning its own drag-and-drop
        (column reorder, board cards) via pragmatic-drag-and-drop. When this view
        is embedded in a page, it lives inside the ProseMirror editor whose
        built-in dragstart handler would otherwise hijack those drags; the global
        drag-handle plugin reads this attribute to bow out (see drag-handle.ts). */}
    <Stack gap="xs" ref={rootRef} data-database-grid>
      <Group justify="space-between" align="center">
        <ViewSwitcher
          databaseId={databaseId}
          embedId={embedId}
          pageId={pageId}
          views={views}
          properties={propertiesQuery.data ?? []}
          activeViewId={activeViewId}
          onActivate={setSelectedViewId}
        />
        <Group gap="sm" align="center" wrap="nowrap">
          {dirty && (
            // Deferred save (#92): the draft has unsaved edits. These actions are
            // hidden until then so the toolbar stays quiet during normal viewing.
            <Group gap="xs" wrap="nowrap">
              <Button
                size="xs"
                variant="subtle"
                color="gray"
                onClick={revertChanges}
              >
                {t("Discard")}
              </Button>
              <Button size="xs" onClick={saveChanges}>
                {t("Save changes")}
              </Button>
            </Group>
          )}
          <DatabasePresenceAvatars />
          <ViewToolbar
            databaseId={databaseId}
            viewType={activeView.type}
            properties={propertiesQuery.data ?? []}
            filters={filters}
            sorts={sorts}
            columns={draft.columns}
            onFiltersChange={changeFilters}
            onSortsChange={changeSorts}
            onToggleColumn={toggleColumn}
            groupByPropertyId={draft.groupByPropertyId}
            onChangeGroupBy={changeGroupBy}
            datePropertyId={draft.datePropertyId}
            onChangeDateProperty={changeDateProperty}
          />
        </Group>
      </Group>
      {activeView.type === "board" ? (
        <BoardView
          databaseId={databaseId}
          properties={propertiesQuery.data ?? []}
          rows={rowsQuery.data ?? []}
          activeView={draftView}
          spaceSlug={spaceSlug}
        />
      ) : activeView.type === "calendar" ? (
        <CalendarView
          databaseId={databaseId}
          properties={propertiesQuery.data ?? []}
          rows={rowsQuery.data ?? []}
          activeView={draftView}
          spaceSlug={spaceSlug}
          onAutoAdoptDate={changeDateProperty}
        />
      ) : !rowsQuery.isLoading &&
        (rowsQuery.data ?? []).length === 0 &&
        (viewConfig?.filters?.length ?? 0) > 0 ? (
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
          activeView={draftView}
          spaceSlug={spaceSlug}
          onHideColumn={(id) => toggleColumn(id, false)}
          onResizeColumn={resizeColumn}
          onResizeTitle={resizeTitle}
          onReorderColumns={reorderColumns}
        />
      )}
    </Stack>
    </EmbedHostProvider>
  );
}

export default DatabaseView;
