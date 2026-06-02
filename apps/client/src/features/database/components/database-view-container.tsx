import { Center, Loader, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { IPage } from "@/features/page/types/page.types.ts";
import {
  useDatabaseInfoQuery,
  useDatabasePropertiesQuery,
  useDatabaseRowsQuery,
} from "@/features/database/queries/database-query.ts";
import { GridView } from "./grid-view/grid-view";

interface DatabaseViewContainerProps {
  page: IPage;
}

export function DatabaseViewContainer({ page }: DatabaseViewContainerProps) {
  const { t } = useTranslation();
  const infoQuery = useDatabaseInfoQuery(page.id);
  const databaseId = infoQuery.data?.database.id ?? "";
  const propertiesQuery = useDatabasePropertiesQuery(databaseId);
  const rowsQuery = useDatabaseRowsQuery(databaseId);

  if (infoQuery.isLoading || !databaseId) {
    return (
      <Center p="xl">
        <Loader />
      </Center>
    );
  }

  if (infoQuery.isError) {
    return (
      <Stack p="md">
        <Text c="red">{t("Failed to load database")}</Text>
      </Stack>
    );
  }

  if (propertiesQuery.isLoading || rowsQuery.isLoading) {
    return (
      <Center p="xl">
        <Loader />
      </Center>
    );
  }

  return (
    <Stack p="md" gap="xs">
      <GridView
        databaseId={databaseId}
        properties={propertiesQuery.data ?? []}
        rows={rowsQuery.data ?? []}
      />
    </Stack>
  );
}

export default DatabaseViewContainer;
