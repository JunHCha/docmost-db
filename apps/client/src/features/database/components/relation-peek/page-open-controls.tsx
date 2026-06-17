import { ActionIcon, Group, Tooltip } from "@mantine/core";
import {
  IconLayoutSidebarRightExpand,
  IconWindowMaximize,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { usePagePeek } from "./use-page-peek.tsx";

interface PageOpenControlsProps {
  pageId: string;
  // Applied to the wrapper so the parent can reveal the controls on hover.
  className?: string;
}

// The two open affordances on a page block (#94): open the page as a right-side
// overlay (side panel) or a centered modal. Clicks stop propagation so they
// don't trigger the block's own click (title edit / relation dropdown).
export function PageOpenControls({ pageId, className }: PageOpenControlsProps) {
  const { t } = useTranslation();
  const { open } = usePagePeek();

  return (
    <Group gap={2} wrap="nowrap" className={className}>
      <Tooltip label={t("Open in side panel")} withArrow openDelay={300}>
        <ActionIcon
          size="xs"
          variant="subtle"
          color="gray"
          aria-label={t("Open in side panel")}
          onClick={(e) => {
            e.stopPropagation();
            open(pageId, "aside");
          }}
        >
          <IconLayoutSidebarRightExpand size={14} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={t("Open in modal")} withArrow openDelay={300}>
        <ActionIcon
          size="xs"
          variant="subtle"
          color="gray"
          aria-label={t("Open in modal")}
          onClick={(e) => {
            e.stopPropagation();
            open(pageId, "modal");
          }}
        >
          <IconWindowMaximize size={14} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
