import { Stack, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { IPage } from "@/features/page/types/page.types.ts";

interface DatabaseViewContainerProps {
  page: IPage;
}

export function DatabaseViewContainer({ page }: DatabaseViewContainerProps) {
  const { t } = useTranslation();

  return (
    <Stack p="md" gap="xs">
      <Title order={2}>{page.title || t("untitled")}</Title>
      <Text c="dimmed">
        {t("Database (views are coming in a follow-up).")}
      </Text>
    </Stack>
  );
}

export default DatabaseViewContainer;
