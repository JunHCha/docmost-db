import {
  keepPreviousData,
  useMutation,
  useQuery,
  UseQueryResult,
} from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import {
  clearValue,
  createDatabase,
  createProperty,
  createRow,
  createView,
  deleteProperty,
  deleteRows,
  deleteView,
  getDatabaseInfo,
  listDatabases,
  listProperties,
  listRows,
  listViews,
  reorderProperty,
  setDefaultView,
  setValue,
  updateProperty,
  updateView,
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "@/features/database/services/database-service.ts";
import {
  IClearValueParams,
  ICreateDatabaseParams,
  ICreateDatabaseResponse,
  ICreatePropertyParams,
  ICreateRowParams,
  IDatabaseInfoResponse,
  IDatabaseListItem,
  IDatabaseProperty,
  IDatabasePropertyValue,
  IDatabaseRow,
  IDatabaseView,
  IDatabaseViewConfig,
  ICreateViewParams,
  IDeletePropertyParams,
  IDeleteRowsParams,
  IReorderPropertyParams,
  ISetValueParams,
  IUpdatePropertyParams,
  IUpdateViewParams,
  IViewIdParams,
  IDatabaseTemplate,
  ICreateTemplateParams,
  IUpdateTemplateParams,
  ITemplateIdParams,
} from "@/features/database/types/database.types.ts";
import { IPage } from "@/features/page/types/page.types.ts";
import {
  appendProperty,
  appendRow,
  databaseInfoByIdKey,
  databaseInfoKey,
  databasePropertiesKey,
  databaseRowsKey,
  databaseViewsKey,
  databasesKey,
  patchProperty,
  patchRowTitle,
  patchRowValue,
  patchView,
  removeProperty,
  removeRows,
  removeRowValue,
  templatesKey,
} from "@/features/database/queries/database-cache.ts";
import {
  invalidateOnCreatePage,
  updatePageData,
} from "@/features/page/queries/page-query.ts";
import { updatePage } from "@/features/page/services/page-service.ts";
import { queryClient } from "@/main.tsx";
import { useDatabaseCollabBroadcast } from "@/features/database/hooks/database-collab-context";

// Rows are not view-scoped on the server yet, so invalidate every cached view
// for the database via the shared prefix.
const rowsPrefix = (databaseId: string) => ["database-rows", databaseId];

interface IUpdateRowTitleParams {
  pageId: string;
  title: string;
}

export function useCreateDatabaseMutation() {
  const { t } = useTranslation();
  return useMutation<ICreateDatabaseResponse, Error, ICreateDatabaseParams>({
    mutationFn: (data) => createDatabase(data),
    onSuccess: (data) => {
      // A database is also a page, so patch the sidebar caches the same way
      // page creation does — keeps the new node (and its parent's hasChildren)
      // consistent with the regular create path.
      invalidateOnCreatePage(data.page);
      // The embed/relation database pickers read the space-scoped ["databases",
      // spaceId] list; invalidate it so a freshly created database appears there
      // immediately instead of staying hidden behind the 5-min staleTime until a
      // manual page refresh.
      queryClient.invalidateQueries({
        queryKey: databasesKey(data.page.spaceId),
      });
    },
    onError: () => {
      notifications.show({
        message: t("Failed to create database"),
        color: "red",
      });
    },
  });
}

export function useDatabaseInfoQuery(pageId: string): UseQueryResult<
  IDatabaseInfoResponse,
  Error
> {
  return useQuery({
    queryKey: databaseInfoKey(pageId),
    queryFn: () => getDatabaseInfo({ pageId }),
    enabled: !!pageId,
  });
}

// Resolve a database by its id rather than the entry pageId — the inline embed
// (issue #24) only carries the databaseId. Mirrors useDatabaseInfoQuery but for
// the databaseId-addressed lookup the server already supports.
export function useDatabaseInfoByIdQuery(databaseId: string): UseQueryResult<
  IDatabaseInfoResponse,
  Error
> {
  return useQuery({
    queryKey: databaseInfoByIdKey(databaseId),
    queryFn: () => getDatabaseInfo({ databaseId }),
    enabled: !!databaseId,
  });
}

export function useListDatabasesQuery(
  spaceId: string,
): UseQueryResult<IDatabaseListItem[], Error> {
  return useQuery({
    queryKey: databasesKey(spaceId),
    queryFn: () => listDatabases({ spaceId }),
    enabled: !!spaceId,
  });
}

export function useDatabasePropertiesQuery(
  databaseId: string,
): UseQueryResult<IDatabaseProperty[], Error> {
  return useQuery({
    queryKey: databasePropertiesKey(databaseId),
    queryFn: () => listProperties({ databaseId }),
    enabled: !!databaseId,
  });
}

export function useDatabaseRowsQuery(
  databaseId: string,
  viewId: string,
  config?: IDatabaseViewConfig,
): UseQueryResult<IDatabaseRow[], Error> {
  const filters = config?.filters;
  const sorts = config?.sorts;
  return useQuery({
    // filters/sorts are part of the key, so each (view, filter, sort) combo
    // caches its own server-filtered result and a filter change forces a
    // refetch (without this segment the 5-min staleTime + refetchOnMount:false
    // in main.tsx would keep serving the previous, unfiltered result).
    queryKey: databaseRowsKey(databaseId, viewId, { filters, sorts }),
    queryFn: () => listRows({ databaseId, filters, sorts }),
    enabled: !!databaseId && !!viewId,
    // Keep showing the previous rows while a filter/sort change refetches.
    // Without this the new queryKey starts with no data (isLoading=true), which
    // swaps the whole view for a loader — unmounting the toolbar and closing the
    // open filter/sort builder mid-edit.
    placeholderData: keepPreviousData,
  });
}

export function useDatabaseViewsQuery(
  databaseId: string,
  embedId?: string,
  // Embed host page. Not part of the query key (the view list is identical
  // regardless) — sent only so the server can backfill source_page_id on seed.
  pageId?: string,
): UseQueryResult<IDatabaseView[], Error> {
  return useQuery({
    queryKey: databaseViewsKey(databaseId, embedId),
    queryFn: () => listViews({ databaseId, embedId, pageId }),
    enabled: !!databaseId,
  });
}

// The view whose rows a read-only consumer (relation picker, row panel) should
// load. Rows are identical across views, so any view works; prefer the default.
export function useDefaultViewId(databaseId: string, embedId?: string): string {
  const { data } = useDatabaseViewsQuery(databaseId, embedId);
  if (!data || data.length === 0) return "";
  return (data.find((v) => v.isDefault) ?? data[0]).id;
}

// Relation values mirror to the related database server-side (#111 Phase C):
// setting/clearing a relation on DB A also writes the reverse value on DB B.
// The relation cell knows its targetDatabaseId, so it passes it here and we
// resync the target's rows (a prefix invalidate hits every cached view/filter
// slot). For non-relation cells targetDatabaseId is undefined and nothing
// extra is invalidated.
export function useSetValueMutation(databaseId: string, targetDatabaseId?: string) {
  const { t } = useTranslation();
  const broadcastChange = useDatabaseCollabBroadcast();
  return useMutation<IDatabasePropertyValue, Error, ISetValueParams>({
    mutationFn: (data) => setValue(data),
    onSuccess: (value) => {
      patchRowValue(queryClient, databaseId, value);
      // Tell other clients on this DB view what changed (#55 Phase 2).
      broadcastChange({ kind: "set", value });
      if (targetDatabaseId) {
        queryClient.invalidateQueries({ queryKey: rowsPrefix(targetDatabaseId) });
      }
    },
    onError: () => {
      // Force a resync so a failed patch never leaves the cache out of step
      // with the server.
      queryClient.invalidateQueries({ queryKey: rowsPrefix(databaseId) });
      notifications.show({ message: t("Failed to update value"), color: "red" });
    },
  });
}

export function useClearValueMutation(
  databaseId: string,
  // See useSetValueMutation — clearing a relation also clears the mirrored
  // value on the related database, so resync its rows when given.
  targetDatabaseId?: string,
) {
  const { t } = useTranslation();
  const broadcastChange = useDatabaseCollabBroadcast();
  return useMutation<void, Error, IClearValueParams>({
    mutationFn: (data) => clearValue(data),
    onSuccess: (_, variables) => {
      removeRowValue(
        queryClient,
        databaseId,
        variables.pageId,
        variables.propertyId,
      );
      broadcastChange({
        kind: "clear",
        pageId: variables.pageId,
        propertyId: variables.propertyId,
      });
      if (targetDatabaseId) {
        queryClient.invalidateQueries({ queryKey: rowsPrefix(targetDatabaseId) });
      }
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: rowsPrefix(databaseId) });
      notifications.show({ message: t("Failed to clear value"), color: "red" });
    },
  });
}

export function useCreateRowMutation(databaseId: string) {
  const { t } = useTranslation();
  const broadcastChange = useDatabaseCollabBroadcast();
  return useMutation<IPage, Error, ICreateRowParams>({
    mutationFn: (data) => createRow(data),
    onSuccess: (page, variables) => {
      // Seed the cached row with the filter-derived initial values (#103) so it
      // appears already filled and survives the active filter without a refetch.
      // The server applies the same values, so a later refetch matches.
      const now = new Date();
      const values: IDatabasePropertyValue[] = Object.entries(
        variables.initialValues ?? {},
      ).map(([propertyId, value]) => ({
        id: `optimistic-${page.id}-${propertyId}`,
        pageId: page.id,
        propertyId,
        value,
        createdAt: now,
        updatedAt: now,
      }));
      appendRow(queryClient, databaseId, page, values);
      // Tell other clients on this DB view about the new row (#55 Phase 3).
      broadcastChange({ kind: "row-create", page });
      // A row is a page parented to the database, but it is intentionally not
      // surfaced in the sidebar tree (Notion-like), so we don't patch the
      // sidebar create cache here.
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: rowsPrefix(databaseId) });
      notifications.show({ message: t("Failed to create row"), color: "red" });
    },
  });
}

export function useDeleteRowsMutation(databaseId: string) {
  const { t } = useTranslation();
  const broadcastChange = useDatabaseCollabBroadcast();
  return useMutation<void, Error, IDeleteRowsParams>({
    mutationFn: (data) => deleteRows(data),
    onMutate: (variables) => {
      // Optimistically drop the selected rows from every cached view.
      removeRows(queryClient, databaseId, variables.pageIds);
    },
    onSuccess: (_, variables) => {
      // Broadcast only after the server confirms the delete, so a rejected
      // delete (rolled back by onError) is never propagated to peers.
      broadcastChange({ kind: "row-delete", pageIds: variables.pageIds });
    },
    onError: () => {
      // Resync on failure so a rejected delete never leaves a row hidden.
      queryClient.invalidateQueries({ queryKey: rowsPrefix(databaseId) });
      notifications.show({ message: t("Failed to delete rows"), color: "red" });
    },
  });
}

export function useUpdateRowTitleMutation(databaseId: string) {
  const { t } = useTranslation();
  return useMutation<IPage, Error, IUpdateRowTitleParams>({
    mutationFn: ({ pageId, title }) => updatePage({ pageId, title }),
    onSuccess: (page) => {
      // Keep both the rows cache (Name column) and the page cache / sidebar
      // in step — a row is a real page.
      patchRowTitle(queryClient, databaseId, page.id, page.title);
      updatePageData(page);
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: rowsPrefix(databaseId) });
      notifications.show({
        message: t("Failed to update row title"),
        color: "red",
      });
    },
  });
}

// A relation property carries its related database id in config.targetDatabaseId.
// Relation property CRUD pairs with a reverse column on the target DB server-side
// (#111 Phase B): create auto-adds it, delete cascade-removes it. So when the
// mutated property is a relation we resync the target DB's properties (and rows,
// since a mirror column can surface mirrored values) from that id.
function relationTargetId(property: IDatabaseProperty): string | undefined {
  if (property?.type !== "relation") return undefined;
  const id = property.config?.targetDatabaseId;
  return typeof id === "string" ? id : undefined;
}

export function useCreatePropertyMutation(databaseId: string) {
  const { t } = useTranslation();
  return useMutation<IDatabaseProperty, Error, ICreatePropertyParams>({
    mutationFn: (data) => createProperty(data),
    onSuccess: (property) => {
      appendProperty(queryClient, databaseId, property);
      const targetId = relationTargetId(property);
      if (targetId) {
        queryClient.invalidateQueries({
          queryKey: databasePropertiesKey(targetId),
        });
        queryClient.invalidateQueries({ queryKey: rowsPrefix(targetId) });
      }
    },
    onError: () => {
      queryClient.invalidateQueries({
        queryKey: databasePropertiesKey(databaseId),
      });
      notifications.show({
        message: t("Failed to create property"),
        color: "red",
      });
    },
  });
}

export function useUpdatePropertyMutation(databaseId: string) {
  const { t } = useTranslation();
  return useMutation<IDatabaseProperty, Error, IUpdatePropertyParams>({
    mutationFn: (data) => updateProperty(data),
    onSuccess: (property, variables) => {
      patchProperty(queryClient, databaseId, property);
      // A type change can migrate existing row values server-side (e.g.
      // select -> text rewrites option ids to labels), so refetch the rows.
      if (variables.type !== undefined) {
        queryClient.invalidateQueries({
          queryKey: rowsPrefix(databaseId),
        });
      }
      // Changing a relation's target re-pairs the reverse column on the related
      // DB (#111), so resync that DB's properties from the updated config.
      const targetId = relationTargetId(property);
      if (targetId) {
        queryClient.invalidateQueries({
          queryKey: databasePropertiesKey(targetId),
        });
        queryClient.invalidateQueries({ queryKey: rowsPrefix(targetId) });
      }
    },
    onError: () => {
      queryClient.invalidateQueries({
        queryKey: databasePropertiesKey(databaseId),
      });
      notifications.show({
        message: t("Failed to update property"),
        color: "red",
      });
    },
  });
}

export function useDeletePropertyMutation(
  databaseId: string,
  // Deleting a relation property cascade-removes its reverse column on the
  // related DB (#111). The delete response is void, so the caller (which knows
  // the property's config.targetDatabaseId) passes it here to resync the
  // related DB's properties.
  targetDatabaseId?: string,
) {
  const { t } = useTranslation();
  return useMutation<void, Error, IDeletePropertyParams>({
    mutationFn: (data) => deleteProperty(data),
    onSuccess: (_, variables) => {
      removeProperty(queryClient, databaseId, variables.propertyId);
      if (targetDatabaseId) {
        queryClient.invalidateQueries({
          queryKey: databasePropertiesKey(targetDatabaseId),
        });
        queryClient.invalidateQueries({ queryKey: rowsPrefix(targetDatabaseId) });
      }
    },
    onError: () => {
      queryClient.invalidateQueries({
        queryKey: databasePropertiesKey(databaseId),
      });
      notifications.show({
        message: t("Failed to delete property"),
        color: "red",
      });
    },
  });
}

export function useReorderPropertyMutation(databaseId: string) {
  const { t } = useTranslation();
  return useMutation<void, Error, IReorderPropertyParams>({
    mutationFn: (data) => reorderProperty(data),
    onSuccess: () => {
      // Position math lives on the server; refetch to get the canonical order.
      queryClient.invalidateQueries({
        queryKey: databasePropertiesKey(databaseId),
      });
    },
    onError: () => {
      queryClient.invalidateQueries({
        queryKey: databasePropertiesKey(databaseId),
      });
      notifications.show({
        message: t("Failed to reorder property"),
        color: "red",
      });
    },
  });
}

// Views are embed-scoped (issue #39), so invalidate/patch target the scope the
// caller is viewing. The original database page passes embedId undefined =>
// the original scope (keyed null).
function invalidateViews(databaseId: string, embedId?: string) {
  queryClient.invalidateQueries({
    queryKey: databaseViewsKey(databaseId, embedId),
  });
}

export function useCreateViewMutation(databaseId: string, embedId?: string) {
  const { t } = useTranslation();
  return useMutation<IDatabaseView, Error, ICreateViewParams>({
    mutationFn: (data) => createView(data),
    onSuccess: () => invalidateViews(databaseId, embedId),
    onError: () => {
      notifications.show({ message: t("Failed to create view"), color: "red" });
    },
  });
}

export function useUpdateViewMutation(databaseId: string, embedId?: string) {
  const { t } = useTranslation();
  return useMutation<IDatabaseView, Error, IUpdateViewParams>({
    mutationFn: (data) => updateView(data),
    // Patch the single updated view in the cache instead of invalidating the
    // whole views query. Invalidation refetches and replaces the views array,
    // which retriggers the container's filters/sorts reseed effect and can
    // clobber an in-flight local edit mid-debounce. Patching keeps the other
    // views' identities stable while still reflecting the server's canonical
    // copy (filters/sorts, columns, name).
    onSuccess: (view) => patchView(queryClient, databaseId, embedId, view),
    onError: () => {
      invalidateViews(databaseId, embedId);
      notifications.show({ message: t("Failed to update view"), color: "red" });
    },
  });
}

export function useSetDefaultViewMutation(databaseId: string, embedId?: string) {
  const { t } = useTranslation();
  return useMutation<void, Error, IViewIdParams>({
    mutationFn: (data) => setDefaultView(data),
    onSuccess: () => invalidateViews(databaseId, embedId),
    onError: () => {
      invalidateViews(databaseId, embedId);
      notifications.show({
        message: t("Failed to set default view"),
        color: "red",
      });
    },
  });
}

export function useDeleteViewMutation(databaseId: string, embedId?: string) {
  const { t } = useTranslation();
  return useMutation<void, Error, IViewIdParams>({
    mutationFn: (data) => deleteView(data),
    onSuccess: () => invalidateViews(databaseId, embedId),
    onError: () => {
      invalidateViews(databaseId, embedId);
      notifications.show({ message: t("Failed to delete view"), color: "red" });
    },
  });
}

// Row-creation templates (issue #91). Templates are database-scoped (not embed-
// scoped), so every mutation invalidates the single ["database-templates", id]
// slot. Mirrors the view CRUD hooks above.
function invalidateTemplates(databaseId: string) {
  queryClient.invalidateQueries({ queryKey: templatesKey(databaseId) });
}

export function useDatabaseTemplatesQuery(
  databaseId: string,
): UseQueryResult<IDatabaseTemplate[], Error> {
  return useQuery({
    queryKey: templatesKey(databaseId),
    queryFn: () => listTemplates({ databaseId }),
    enabled: !!databaseId,
  });
}

export function useCreateTemplateMutation(databaseId: string) {
  const { t } = useTranslation();
  return useMutation<IDatabaseTemplate, Error, ICreateTemplateParams>({
    mutationFn: (data) => createTemplate(data),
    onSuccess: () => invalidateTemplates(databaseId),
    onError: () => {
      notifications.show({
        message: t("Failed to create template"),
        color: "red",
      });
    },
  });
}

export function useUpdateTemplateMutation(databaseId: string) {
  const { t } = useTranslation();
  return useMutation<IDatabaseTemplate, Error, IUpdateTemplateParams>({
    mutationFn: (data) => updateTemplate(data),
    onSuccess: () => invalidateTemplates(databaseId),
    onError: () => {
      notifications.show({
        message: t("Failed to update template"),
        color: "red",
      });
    },
  });
}

export function useDeleteTemplateMutation(databaseId: string) {
  const { t } = useTranslation();
  return useMutation<void, Error, ITemplateIdParams>({
    mutationFn: (data) => deleteTemplate(data),
    onSuccess: () => invalidateTemplates(databaseId),
    onError: () => {
      notifications.show({
        message: t("Failed to delete template"),
        color: "red",
      });
    },
  });
}
