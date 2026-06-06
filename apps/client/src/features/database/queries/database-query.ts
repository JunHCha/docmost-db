import {
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
} from "@/features/database/types/database.types.ts";
import { IPage } from "@/features/page/types/page.types.ts";
import {
  appendProperty,
  appendRow,
  databaseInfoKey,
  databasePropertiesKey,
  databaseRowsKey,
  databaseViewsKey,
  databasesKey,
  patchProperty,
  patchRowTitle,
  patchRowValue,
  removeProperty,
  removeRows,
  removeRowValue,
} from "@/features/database/queries/database-cache.ts";
import {
  invalidateOnCreatePage,
  updatePageData,
} from "@/features/page/queries/page-query.ts";
import { updatePage } from "@/features/page/services/page-service.ts";
import { queryClient } from "@/main.tsx";

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
    // viewId is part of the key, so each view caches its own filtered/sorted
    // result independently (the server applies the view's filters/sorts).
    queryKey: databaseRowsKey(databaseId, viewId),
    queryFn: () => listRows({ databaseId, filters, sorts }),
    enabled: !!databaseId && !!viewId,
  });
}

export function useDatabaseViewsQuery(
  databaseId: string,
): UseQueryResult<IDatabaseView[], Error> {
  return useQuery({
    queryKey: databaseViewsKey(databaseId),
    queryFn: () => listViews({ databaseId }),
    enabled: !!databaseId,
  });
}

// The view whose rows a read-only consumer (relation picker, row panel) should
// load. Rows are identical across views, so any view works; prefer the default.
export function useDefaultViewId(databaseId: string): string {
  const { data } = useDatabaseViewsQuery(databaseId);
  if (!data || data.length === 0) return "";
  return (data.find((v) => v.isDefault) ?? data[0]).id;
}

export function useSetValueMutation(databaseId: string) {
  const { t } = useTranslation();
  return useMutation<IDatabasePropertyValue, Error, ISetValueParams>({
    mutationFn: (data) => setValue(data),
    onSuccess: (value) => {
      patchRowValue(queryClient, databaseId, value);
    },
    onError: () => {
      // Force a resync so a failed patch never leaves the cache out of step
      // with the server.
      queryClient.invalidateQueries({ queryKey: rowsPrefix(databaseId) });
      notifications.show({ message: t("Failed to update value"), color: "red" });
    },
  });
}

export function useClearValueMutation(databaseId: string) {
  const { t } = useTranslation();
  return useMutation<void, Error, IClearValueParams>({
    mutationFn: (data) => clearValue(data),
    onSuccess: (_, variables) => {
      removeRowValue(
        queryClient,
        databaseId,
        variables.pageId,
        variables.propertyId,
      );
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: rowsPrefix(databaseId) });
      notifications.show({ message: t("Failed to clear value"), color: "red" });
    },
  });
}

export function useCreateRowMutation(databaseId: string) {
  const { t } = useTranslation();
  return useMutation<IPage, Error, ICreateRowParams>({
    mutationFn: (data) => createRow(data),
    onSuccess: (page) => {
      appendRow(queryClient, databaseId, page);
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
  return useMutation<void, Error, IDeleteRowsParams>({
    mutationFn: (data) => deleteRows(data),
    onMutate: (variables) => {
      // Optimistically drop the selected rows from every cached view.
      removeRows(queryClient, databaseId, variables.pageIds);
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

export function useCreatePropertyMutation(databaseId: string) {
  const { t } = useTranslation();
  return useMutation<IDatabaseProperty, Error, ICreatePropertyParams>({
    mutationFn: (data) => createProperty(data),
    onSuccess: (property) => {
      appendProperty(queryClient, databaseId, property);
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

export function useDeletePropertyMutation(databaseId: string) {
  const { t } = useTranslation();
  return useMutation<void, Error, IDeletePropertyParams>({
    mutationFn: (data) => deleteProperty(data),
    onSuccess: (_, variables) => {
      removeProperty(queryClient, databaseId, variables.propertyId);
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

function invalidateViews(databaseId: string) {
  queryClient.invalidateQueries({ queryKey: databaseViewsKey(databaseId) });
}

export function useCreateViewMutation(databaseId: string) {
  const { t } = useTranslation();
  return useMutation<IDatabaseView, Error, ICreateViewParams>({
    mutationFn: (data) => createView(data),
    onSuccess: () => invalidateViews(databaseId),
    onError: () => {
      notifications.show({ message: t("Failed to create view"), color: "red" });
    },
  });
}

export function useUpdateViewMutation(databaseId: string) {
  const { t } = useTranslation();
  return useMutation<IDatabaseView, Error, IUpdateViewParams>({
    mutationFn: (data) => updateView(data),
    onSuccess: () => invalidateViews(databaseId),
    onError: () => {
      invalidateViews(databaseId);
      notifications.show({ message: t("Failed to update view"), color: "red" });
    },
  });
}

export function useSetDefaultViewMutation(databaseId: string) {
  const { t } = useTranslation();
  return useMutation<void, Error, IViewIdParams>({
    mutationFn: (data) => setDefaultView(data),
    onSuccess: () => invalidateViews(databaseId),
    onError: () => {
      invalidateViews(databaseId);
      notifications.show({
        message: t("Failed to set default view"),
        color: "red",
      });
    },
  });
}

export function useDeleteViewMutation(databaseId: string) {
  const { t } = useTranslation();
  return useMutation<void, Error, IViewIdParams>({
    mutationFn: (data) => deleteView(data),
    onSuccess: () => invalidateViews(databaseId),
    onError: () => {
      invalidateViews(databaseId);
      notifications.show({ message: t("Failed to delete view"), color: "red" });
    },
  });
}
