import { Center, Loader, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { usePageQuery } from "@/features/page/queries/page-query.ts";
import { FullEditor } from "@/features/editor/full-editor.tsx";
import { RowPropertiesPanel } from "@/features/database/components/row-properties-panel.tsx";
import { DatabaseViewContainer } from "@/features/database/components/database-view-container.tsx";
import { PageIcon } from "@/features/page/components/page-icon.tsx";

interface RelationPagePeekProps {
  pageId: string;
}

// The editable preview body shared by the aside and modal hosts (#94). It loads
// the previewed page and mounts the real collaborative editor in `embedded`
// (peek) mode — so edits to the title, properties and body persist to the same
// page document — without the editor hijacking the host page's global state.
export function RelationPagePeek({ pageId }: RelationPagePeekProps) {
  const { t } = useTranslation();
  // `content` isn't included in the database row list, so fetch the full page.
  const { data: page, isLoading } = usePageQuery({ pageId });

  if (isLoading || !page) {
    return (
      <Center h={200}>
        {isLoading ? (
          <Loader />
        ) : (
          <Text size="sm" c="dimmed">
            {t("Page not found")}
          </Text>
        )}
      </Center>
    );
  }

  // A relation may point at a database page itself; render its view rather than
  // a document editor (mirrors the page route).
  if (page.pageType === "database") {
    return <DatabaseViewContainer key={page.id} page={page} />;
  }

  const canEdit = !page.deletedAt && (page.permissions?.canEdit ?? false);

  return (
    <FullEditor
      key={page.id}
      pageId={page.id}
      slugId={page.slugId}
      title={page.title}
      content={page.content}
      spaceSlug={page.space?.slug}
      editable={canEdit}
      creator={page.creator}
      contributors={page.contributors}
      canComment={false}
      embedded
      // Clickable page icon above the title, same as the routed page (item 4).
      pageIcon={
        <PageIcon
          pageId={page.id}
          spaceId={page.spaceId}
          icon={page.icon}
          pageType={page.pageType}
          editable={canEdit}
        />
      }
      // Database-row properties shown Notion-style under the title (#9), editable.
      belowTitle={<RowPropertiesPanel page={page} />}
    />
  );
}

export default RelationPagePeek;
