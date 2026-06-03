import { useState } from "react";
import { Center, Loader, Stack, Text, TextInput } from "@mantine/core";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IPage } from "@/features/page/types/page.types.ts";
import {
  useDatabaseInfoQuery,
  useDatabasePropertiesQuery,
  useDatabaseRowsQuery,
} from "@/features/database/queries/database-query.ts";
import { useUpdatePageMutation } from "@/features/page/queries/page-query.ts";
import { GridView } from "./grid-view/grid-view";

interface DatabaseViewContainerProps {
  page: IPage;
}

export function DatabaseViewContainer({ page }: DatabaseViewContainerProps) {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const infoQuery = useDatabaseInfoQuery(page.id);
  const databaseId = infoQuery.data?.database.id ?? "";
  const propertiesQuery = useDatabasePropertiesQuery(databaseId);
  const rowsQuery = useDatabaseRowsQuery(databaseId);
  const updatePage = useUpdatePageMutation();
  const [titleDraft, setTitleDraft] = useState(page.title ?? "");

  function commitTitle() {
    const next = titleDraft.trim();
    if (next && next !== page.title) {
      updatePage.mutate({ pageId: page.id, title: next });
    }
  }

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
      <GridView
        databaseId={databaseId}
        properties={propertiesQuery.data ?? []}
        rows={rowsQuery.data ?? []}
        spaceSlug={spaceSlug}
      />
    </Stack>
  );
}

export default DatabaseViewContainer;
