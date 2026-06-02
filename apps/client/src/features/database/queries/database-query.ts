import {
  useMutation,
  useQuery,
  UseQueryResult,
} from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import {
  createDatabase,
  getDatabaseInfo,
  getDatabaseList,
} from "@/features/database/services/database-service.ts";
import {
  ICreateDatabaseParams,
  ICreateDatabaseResponse,
  IDatabase,
  IDatabaseInfoResponse,
} from "@/features/database/types/database.types.ts";

export function useCreateDatabaseMutation() {
  const { t } = useTranslation();
  return useMutation<ICreateDatabaseResponse, Error, ICreateDatabaseParams>({
    mutationFn: (data) => createDatabase(data),
    onError: () => {
      notifications.show({
        message: t("Failed to create database"),
        color: "red",
      });
    },
  });
}

export function useDatabaseInfoQuery(
  databaseId: string,
): UseQueryResult<IDatabaseInfoResponse, Error> {
  return useQuery({
    queryKey: ["database", databaseId],
    queryFn: () => getDatabaseInfo({ databaseId }),
    enabled: !!databaseId,
  });
}

export function useDatabaseListQuery(
  spaceId: string,
): UseQueryResult<IDatabase[], Error> {
  return useQuery({
    queryKey: ["database-list", spaceId],
    queryFn: () => getDatabaseList({ spaceId }),
    enabled: !!spaceId,
  });
}
