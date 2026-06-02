import { useMutation } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { createDatabase } from "@/features/database/services/database-service.ts";
import {
  ICreateDatabaseParams,
  ICreateDatabaseResponse,
} from "@/features/database/types/database.types.ts";
import { invalidateOnCreatePage } from "@/features/page/queries/page-query.ts";

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
