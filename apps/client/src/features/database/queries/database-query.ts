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
  deleteProperty,
  getDatabaseInfo,
  listProperties,
  listRows,
  reorderProperty,
  setValue,
  updateProperty,
} from "@/features/database/services/database-service.ts";
import {
  IClearValueParams,
  ICreateDatabaseParams,
  ICreateDatabaseResponse,
  ICreatePropertyParams,
  ICreateRowParams,
  IDatabaseInfoResponse,
  IDatabaseProperty,
  IDatabasePropertyValue,
  IDatabaseRow,
  IDeletePropertyParams,
  IReorderPropertyParams,
  ISetValueParams,
  IUpdatePropertyParams,
} from "@/features/database/types/database.types.ts";
import { IPage } from "@/features/page/types/page.types.ts";
import {
  appendProperty,
  appendRow,
  databaseInfoKey,
  databasePropertiesKey,
  databaseRowsKey,
  patchProperty,
  patchRowValue,
  removeProperty,
  removeRowValue,
} from "@/features/database/queries/database-cache.ts";
import { invalidateOnCreatePage } from "@/features/page/queries/page-query.ts";
import { queryClient } from "@/main.tsx";

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
): UseQueryResult<IDatabaseRow[], Error> {
  return useQuery({
    queryKey: databaseRowsKey(databaseId),
    queryFn: () => listRows({ databaseId }),
    enabled: !!databaseId,
  });
}

export function useSetValueMutation(databaseId: string) {
  const { t } = useTranslation();
  return useMutation<IDatabasePropertyValue, Error, ISetValueParams>({
    mutationFn: (data) => setValue(data),
    onSuccess: (value) => {
      patchRowValue(queryClient, databaseId, value);
    },
    onError: () => {
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
      // The row is also a page, so keep the sidebar tree consistent.
      invalidateOnCreatePage(page);
    },
    onError: () => {
      notifications.show({ message: t("Failed to create row"), color: "red" });
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
    onSuccess: (property) => {
      patchProperty(queryClient, databaseId, property);
    },
    onError: () => {
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
      notifications.show({
        message: t("Failed to reorder property"),
        color: "red",
      });
    },
  });
}
