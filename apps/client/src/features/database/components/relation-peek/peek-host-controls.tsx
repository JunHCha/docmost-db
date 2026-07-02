import { ActionIcon, Group, Tooltip } from "@mantine/core";
import { IconArrowUpRight, IconX } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePageQuery } from "@/features/page/queries/page-query.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { usePagePeek } from "./use-page-peek.tsx";

// Header controls for the open peek: jump to the full page, switch the host
// (aside overlay ↔ centered modal), and close.
export function PeekHostControls() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pageId, close } = usePagePeek();
  // Shares the ["pages", id] cache the peek body already populates.
  const { data: page } = usePageQuery({ pageId: pageId ?? undefined });

  const goToPage = () => {
    if (!page) return;
    navigate(buildPageUrl(page.space?.slug, page.slugId, page.title));
    close();
  };

  return (
    <Group gap={4} wrap="nowrap" justify="flex-end" w="100%">
      <Tooltip label={t("Open as page")} withArrow>
        <ActionIcon
          variant="subtle"
          color="gray"
          onClick={goToPage}
          disabled={!page}
          aria-label={t("Open as page")}
        >
          <IconArrowUpRight size={18} />
        </ActionIcon>
      </Tooltip>
      {/* The aside↔modal toggle is temporarily hidden — the modal host is
          disabled, so the peek always stays in the side panel. */}
      <Tooltip label={t("Close")} withArrow>
        <ActionIcon
          variant="subtle"
          color="gray"
          onClick={close}
          aria-label={t("Close")}
        >
          <IconX size={18} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
