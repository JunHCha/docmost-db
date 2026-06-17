import { Text } from "@mantine/core";
import { IconDatabase, IconFileDescription } from "@tabler/icons-react";
import { PageOpenControls } from "@/features/database/components/relation-peek/page-open-controls.tsx";
import classes from "./page-ref-chip.module.css";

// The page's emoji, or a default doc/database glyph — mirrors the sidebar tree
// row fallback. Shared by the relation chip and the relation picker rows (#94).
export function PageGlyph({
  icon,
  pageType,
}: {
  icon?: string | null;
  pageType?: string;
}) {
  return (
    <span className={classes.icon} aria-hidden>
      {icon ? (
        icon
      ) : pageType === "database" ? (
        <IconDatabase size={14} />
      ) : (
        <IconFileDescription size={14} />
      )}
    </span>
  );
}

interface PageRefChipProps {
  pageId: string;
  title: string;
  icon?: string | null;
  pageType?: string;
}

// A relation value rendered like a sidebar page block (#94): the page's icon +
// title, with side-panel / modal open icons revealed on hover. The title itself
// is inert here so a click bubbles to the cell's relation picker; only the open
// icons act (they stop propagation).
export function PageRefChip({ pageId, title, icon, pageType }: PageRefChipProps) {
  return (
    <span className={classes.chip}>
      <PageGlyph icon={icon} pageType={pageType} />
      <Text size="sm" lineClamp={1} className={classes.title}>
        {title}
      </Text>
      <PageOpenControls pageId={pageId} className={classes.controls} />
    </span>
  );
}

export default PageRefChip;
