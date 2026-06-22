import { ActionIcon, Group, Tooltip } from "@mantine/core";
import {
  IconArrowUpRight,
  IconLayoutSidebarRightExpand,
  IconWindowMaximize,
  IconX,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTemplatePeek } from "./use-template-peek";
import { buildTemplatePageUrl } from "./template-peek.utils";

// Header controls for the open template peek (overlay hosts): open on its own
// page, switch host (aside ↔ modal), and close. Mirrors the relation peek.
export function TemplatePeekHostControls() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { databaseId, templateId, host, setHost, close } = useTemplatePeek();

  const goToPage = () => {
    if (!databaseId) return;
    navigate(buildTemplatePageUrl(databaseId, templateId));
    close();
  };

  return (
    <Group gap={4} wrap="nowrap">
      <Tooltip label={t("Open as page")} withArrow>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          onClick={goToPage}
          aria-label={t("Open as page")}
        >
          <IconArrowUpRight size={16} />
        </ActionIcon>
      </Tooltip>
      {host === "aside" ? (
        <Tooltip label={t("Open in modal")} withArrow>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={() => setHost("modal")}
            aria-label={t("Open in modal")}
          >
            <IconWindowMaximize size={16} />
          </ActionIcon>
        </Tooltip>
      ) : (
        <Tooltip label={t("Open in side panel")} withArrow>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={() => setHost("aside")}
            aria-label={t("Open in side panel")}
          >
            <IconLayoutSidebarRightExpand size={16} />
          </ActionIcon>
        </Tooltip>
      )}
      <Tooltip label={t("Close")} withArrow>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          onClick={close}
          aria-label={t("Close")}
        >
          <IconX size={16} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
