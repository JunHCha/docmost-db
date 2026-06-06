import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import {
  ActionIcon,
  Anchor,
  Box,
  Center,
  Group,
  Loader,
  Menu,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconArrowUpRight, IconDots, IconTrash } from "@tabler/icons-react";
import { ErrorBoundary } from "react-error-boundary";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useDatabaseInfoQuery,
  useDatabaseViewsQuery,
} from "@/features/database/queries/database-query.ts";
import { DatabaseEmbedContainer } from "@/features/database/components/database-embed-container.tsx";
import { buildPageUrl } from "@/features/page/page.utils.ts";

// ---------------------------------------------------------------------------
// Placeholder helpers
// ---------------------------------------------------------------------------

function NoAccessPlaceholder() {
  const { t } = useTranslation();
  return (
    <Box
      p="sm"
      style={{
        border: "1px dashed var(--mantine-color-gray-4)",
        borderRadius: "var(--mantine-radius-sm)",
      }}
    >
      <Text c="dimmed" size="sm">
        {t("You do not have access to this database")}
      </Text>
    </Box>
  );
}

function NotFoundPlaceholder() {
  const { t } = useTranslation();
  return (
    <Box
      p="sm"
      style={{
        border: "1px dashed var(--mantine-color-gray-4)",
        borderRadius: "var(--mantine-radius-sm)",
      }}
    >
      <Text c="dimmed" size="sm">
        {t("Database not found")}
      </Text>
    </Box>
  );
}

function ErrorPlaceholder() {
  const { t } = useTranslation();
  return (
    <Box
      p="sm"
      style={{
        border: "1px dashed var(--mantine-color-red-4)",
        borderRadius: "var(--mantine-radius-sm)",
      }}
    >
      <Text c="red" size="sm">
        {t("Failed to load database")}
      </Text>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Header shown above the embedded grid/board
// ---------------------------------------------------------------------------

interface EmbedHeaderProps {
  pageId: string;
  viewId: string | null;
  isEditable: boolean;
  onDelete: () => void;
}

function EmbedHeader({
  pageId,
  viewId,
  isEditable,
  onDelete,
}: EmbedHeaderProps) {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const infoQuery = useDatabaseInfoQuery(pageId);
  const databaseId = infoQuery.data?.database?.id ?? "";
  const viewsQuery = useDatabaseViewsQuery(databaseId);

  const dbTitle = infoQuery.data?.page?.title ?? t("Database");
  const activeViewName = viewsQuery.data?.find((v) => v.id === viewId)?.name;

  // Build a link to the source database page (same pattern as transclusion
  // "Edit source" link). Falls back to /p/<pageId> when spaceSlug is absent.
  const page = infoQuery.data?.page;
  const sourceHref =
    page && spaceSlug
      ? buildPageUrl(spaceSlug, page.slugId, page.title)
      : `/p/${pageId}`;

  return (
    <Group justify="space-between" align="center" px="xs" pt="xs" pb={4}>
      <Group gap={4} align="center">
        <IconArrowUpRight size={14} color="var(--mantine-color-blue-5)" />
        <Anchor
          component={Link}
          to={sourceHref}
          size="sm"
          fw={600}
          style={{ textDecoration: "none" }}
        >
          {dbTitle}
        </Anchor>
        {activeViewName && (
          <Text size="sm" c="dimmed">
            · {activeViewName}
          </Text>
        )}
      </Group>
      {isEditable && (
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" size="sm">
              <IconDots size={14} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              color="red"
              leftSection={<IconTrash size={14} />}
              onClick={onDelete}
            >
              {t("Remove from page")}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      )}
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Inner body — separated so ErrorBoundary wraps only the data-fetching part
// ---------------------------------------------------------------------------

function DatabaseEmbedBody({
  editor,
  node,
  deleteNode,
}: NodeViewProps) {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const isEditable = editor.isEditable;
  const pageId: string | null = node.attrs.databaseId ?? null;
  const viewId: string | null = node.attrs.viewId ?? null;

  // Missing attrs → broken node
  if (!pageId) {
    return (
      <>
        {isEditable && (
          <Tooltip label={t("Remove from page")}>
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              onClick={() => deleteNode()}
              style={{ float: "right" }}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        )}
        <NotFoundPlaceholder />
      </>
    );
  }

  // Probe the info query directly so we can branch on 403 vs 404.
  const infoQuery = useDatabaseInfoQuery(pageId);

  if (infoQuery.isLoading) {
    return (
      <Center p="md">
        <Loader size="sm" />
      </Center>
    );
  }

  // 403 — server returns ForbiddenException
  if (infoQuery.isError) {
    const status = (infoQuery.error as any)?.response?.status;
    if (status === 403) return <NoAccessPlaceholder />;
    return <ErrorPlaceholder />;
  }

  // The page exists but is not a database
  if (!infoQuery.data?.database) {
    return (
      <>
        {isEditable && (
          <Group justify="flex-end" px="xs" pt="xs">
            <Tooltip label={t("Remove from page")}>
              <ActionIcon
                variant="subtle"
                color="red"
                size="sm"
                onClick={() => deleteNode()}
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}
        <NotFoundPlaceholder />
      </>
    );
  }

  return (
    <Stack gap={0}>
      <EmbedHeader
        pageId={pageId}
        viewId={viewId}
        isEditable={isEditable}
        onDelete={() => deleteNode()}
      />
      <Box
        style={{
          borderRadius: "var(--mantine-radius-sm)",
          border: "1px solid var(--mantine-color-gray-3)",
          overflow: "hidden",
        }}
      >
        <DatabaseEmbedContainer
          pageId={pageId}
          initialViewId={viewId}
          spaceSlug={spaceSlug}
        />
      </Box>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Public NodeView component registered with DatabaseView.configure({ view })
// ---------------------------------------------------------------------------

export default function DatabaseEmbedView(props: NodeViewProps) {
  return (
    <NodeViewWrapper contentEditable={false}>
      <ErrorBoundary
        resetKeys={[props.node.attrs.databaseId, props.node.attrs.viewId]}
        fallback={<ErrorPlaceholder />}
      >
        <DatabaseEmbedBody {...props} />
      </ErrorBoundary>
    </NodeViewWrapper>
  );
}
