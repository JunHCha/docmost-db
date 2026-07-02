import { IconDatabase, IconFileDescription } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import EmojiPicker from "@/components/ui/emoji-picker.tsx";
import { useUpdatePageMutation } from "@/features/page/queries/page-query.ts";
import { useQueryEmit } from "@/features/websocket/use-query-emit.ts";

export interface PageIconProps {
  pageId: string;
  spaceId: string;
  icon: string | null;
  pageType?: "doc" | "database";
  editable: boolean;
  // Rendered glyph size (px) for the emoji / default icon. Header icons are
  // larger than the sidebar tree's 18px.
  size?: number;
}

// Clickable page icon shown above the title on a page or database page (item 4).
// A set emoji renders as-is; otherwise a type-appropriate default (database vs
// document) keeps the two visually distinct, mirroring the sidebar tree row.
// Clicking opens the emoji picker to edit; the change persists via the page
// update mutation (which refreshes the page cache) and broadcasts to peers.
export function PageIcon({
  pageId,
  spaceId,
  icon,
  pageType,
  editable,
  size = 40,
}: PageIconProps) {
  const { t } = useTranslation();
  const updatePageMutation = useUpdatePageMutation();
  const emit = useQueryEmit();

  function persistIcon(nextIcon: string | null) {
    updatePageMutation.mutateAsync({ pageId, icon: nextIcon }).then((data) => {
      setTimeout(() => {
        emit({
          operation: "updateOne",
          spaceId,
          entity: ["pages"],
          id: pageId,
          payload: { icon: nextIcon, parentPageId: data.parentPageId },
        });
      }, 50);
    });
  }

  return (
    <div className="print-hide" style={{ marginBottom: "0.25rem" }}>
      <EmojiPicker
        onEmojiSelect={(emoji: { native: string }) => persistIcon(emoji.native)}
        icon={
          icon ? (
            <span
              style={{
                fontSize: size,
                lineHeight: 1,
                display: "inline-flex",
              }}
            >
              {icon}
            </span>
          ) : pageType === "database" ? (
            <IconDatabase size={size} stroke={1.5} />
          ) : (
            <IconFileDescription size={size} stroke={1.5} />
          )
        }
        readOnly={!editable}
        removeEmojiAction={() => persistIcon(null)}
        // Box a little larger than the glyph so tall emoji aren't clipped.
        actionIconProps={{ size: size + 8, c: "gray" }}
      />
    </div>
  );
}

export default PageIcon;
