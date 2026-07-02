import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Stack, Text, Anchor, ActionIcon } from "@mantine/core";
import { IconDatabase, IconFileDescription } from "@tabler/icons-react";
import { useGetSidebarPagesQuery } from "@/features/page/queries/page-query";
import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import classes from "./subpages.module.css";
import styles from "../mention/mention.module.css";
import {
  buildPageUrl,
  buildSharedPageUrl,
} from "@/features/page/page.utils.ts";
import { useTranslation } from "react-i18next";
import { sortPositionKeys } from "@/features/page/tree/utils/utils";
import { useSharedPageSubpages } from "@/features/share/hooks/use-shared-page-subpages";

export default function SubpagesView(props: NodeViewProps) {
  const { editor } = props;
  const { spaceSlug, shareId } = useParams();
  const { t } = useTranslation();

  //@ts-ignore
  const currentPageId = editor.storage.pageId;

  // Get subpages from shared tree if we're in a shared context
  const sharedSubpages = useSharedPageSubpages(currentPageId);

  const { data, isLoading, error } = useGetSidebarPagesQuery(
    shareId ? null : { pageId: currentPageId },
  );

  const subpages = useMemo(() => {
    // If we're in a shared context, use the shared subpages
    if (shareId && sharedSubpages) {
      return sharedSubpages.map((node) => ({
        id: node.value,
        slugId: node.slugId,
        title: node.name,
        icon: node.icon,
        position: node.position,
        // Shared tree nodes don't declare pageType; use it if present at runtime.
        pageType: (node as { pageType?: string }).pageType,
      }));
    }

    // Otherwise use the API data
    if (!data?.pages) return [];
    const allPages = data.pages.flatMap((page) => page.items);
    return sortPositionKeys(allPages);
  }, [data, shareId, sharedSubpages]);

  if (isLoading && !shareId) {
    return null;
  }

  if (error && !shareId) {
    return (
      <NodeViewWrapper data-drag-handle>
        <Text c="dimmed" size="md" py="md">
          {t("Failed to load subpages")}
        </Text>
      </NodeViewWrapper>
    );
  }

  if (subpages.length === 0) {
    return (
      <NodeViewWrapper data-drag-handle>
        <div className={classes.container}>
          <Text c="dimmed" size="md" py="md">
            {t("No subpages")}
          </Text>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper data-drag-handle>
      <div className={classes.container}>
        <Stack gap={5}>
          {subpages.map((page) => (
            <Anchor
              key={page.id}
              component={Link}
              fw={500}
              to={
                shareId
                  ? buildSharedPageUrl({
                      shareId,
                      pageSlugId: page.slugId,
                      pageTitle: page.title,
                    })
                  : buildPageUrl(spaceSlug, page.slugId, page.title)
              }
              underline="never"
              className={styles.pageMentionLink}
              draggable={false}
            >
              {page?.icon ? (
                <span style={{ marginRight: "4px" }}>{page.icon}</span>
              ) : (
                <ActionIcon
                  variant="transparent"
                  color="gray"
                  component="span"
                  size={18}
                  style={{ verticalAlign: "text-bottom" }}
                >
                  {/* Databases get the DB glyph so they read as databases, not
                      plain docs, in the child-page list (mirrors the sidebar). */}
                  {(page as { pageType?: string })?.pageType === "database" ? (
                    <IconDatabase size={18} />
                  ) : (
                    <IconFileDescription size={18} />
                  )}
                </ActionIcon>
              )}

              <span className={styles.pageMentionText}>
                {page?.title || t("untitled")}
              </span>
            </Anchor>
          ))}
        </Stack>
      </div>
    </NodeViewWrapper>
  );
}
