import { useEffect, useRef, useState } from "react";
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { ActionIcon, Center, Loader, Menu, Tooltip } from "@mantine/core";
import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconDots,
  IconEyeOff,
  IconInfoCircle,
  IconTrash,
} from "@tabler/icons-react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ErrorBoundary } from "react-error-boundary";
import { useDatabaseInfoByIdQuery } from "@/features/database/queries/database-query.ts";
import { DatabaseView } from "@/features/database/components/database-view.tsx";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { resolveEmbedState } from "./embed-state";
import classes from "./database-embed.module.css";

export default function DatabaseEmbedView(props: NodeViewProps) {
  const isEditable = props.editor.isEditable;
  const databaseId: string | null = props.node.attrs.databaseId ?? null;
  const viewId: string | null = props.node.attrs.viewId ?? null;
  const embedId: string | null = props.node.attrs.embedId ?? null;

  // Backfill an embedId on legacy embeds inserted before issue #39. Idempotent:
  // once an id exists the effect short-circuits. Collaborative docs converge on
  // a single id because only the editing client writes it (skipped on missing
  // updateAttributes / read-only mounts).
  useEffect(() => {
    if (!embedId && isEditable && props.updateAttributes) {
      props.updateAttributes({ embedId: crypto.randomUUID() });
    }
  }, [embedId, isEditable, props.updateAttributes]);

  // Lazy mount (issue #39): a long page with many embeds would otherwise fire
  // every embed's info/views/rows queries at once on mount. Only mount the body
  // once the wrapper scrolls near the viewport. Once visible we keep it mounted
  // and disconnect, so scrolling away does not unmount/refetch or flicker.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);

  useEffect(() => {
    if (hasBeenVisible) return;
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setHasBeenVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasBeenVisible]);

  return (
    <NodeViewWrapper
      className={classes.embedWrap}
      data-editable={isEditable ? "true" : "false"}
      data-focused={isEditable && props.selected ? "true" : "false"}
      contentEditable={false}
    >
      <div ref={wrapperRef}>
        {hasBeenVisible ? (
          <ErrorBoundary
            resetKeys={[databaseId, viewId]}
            fallback={<ErrorPlaceholder />}
          >
            <DatabaseEmbedBody {...props} />
          </ErrorBoundary>
        ) : (
          <div
            data-testid="database-embed-placeholder"
            className={classes.lazyPlaceholder}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}

function DatabaseEmbedBody({ editor, node, deleteNode }: NodeViewProps) {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const databaseId: string | null = node.attrs.databaseId ?? null;
  const viewId: string | null = node.attrs.viewId ?? null;
  const embedId: string | null = node.attrs.embedId ?? null;
  // Host page id the editor stashes on its storage (page-editor sets it). Lets
  // the server scope save-time orphan reconcile to this page (issue #60).
  const pageId: string | undefined =
    (editor.storage as { pageId?: string } | undefined)?.pageId ?? undefined;
  const isEditable = editor.isEditable;

  const infoQuery = useDatabaseInfoByIdQuery(databaseId ?? "");
  // The api-client interceptor leaves the raw axios error to reject, so the
  // forbidden/not-found split reads the status straight off error.response.
  const status: number | undefined = (infoQuery.error as any)?.response?.status;

  const state = resolveEmbedState({
    databaseId,
    isLoading: !!databaseId && infoQuery.isLoading,
    isError: infoQuery.isError,
    status,
    database: infoQuery.data?.database,
  });

  if (state.kind === "loading") {
    return (
      <Center p="md">
        <Loader size="sm" />
      </Center>
    );
  }

  if (state.kind === "no_access") {
    return (
      <Placeholder
        icon={<IconEyeOff size={18} stroke={1.6} />}
        label={t("You don't have access to this database")}
      />
    );
  }

  if (state.kind === "not_found") {
    return (
      <Placeholder
        icon={<IconInfoCircle size={18} stroke={1.6} />}
        label={t("The original database no longer exists")}
        onRemove={isEditable ? () => deleteNode() : undefined}
        removeLabel={t("Remove from page")}
      />
    );
  }

  if (state.kind === "error") {
    return <ErrorPlaceholder />;
  }

  const database = state.database;
  const sourcePage = infoQuery.data?.page;
  const sourceHref = sourcePage
    ? buildPageUrl(spaceSlug, sourcePage.slugId, sourcePage.title)
    : null;

  return (
    <>
      <div className={classes.embedHeader} contentEditable={false}>
        {sourceHref ? (
          <Tooltip label={t("Open source database")}>
            <ActionIcon
              component={Link}
              to={sourceHref}
              variant="subtle"
              color="gray"
              size="sm"
              style={{ textDecoration: "none", borderBottom: "none" }}
            >
              <IconArrowUpRight size={16} />
            </ActionIcon>
          </Tooltip>
        ) : (
          <IconArrowUpRight size={16} className={classes.headerIcon} />
        )}
        <span className={classes.headerTitle}>
          {sourcePage?.title || t("Untitled")}
        </span>
        {isEditable && (
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                className={classes.headerMenu}
              >
                <IconDots size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                color="red"
                leftSection={<IconTrash size={14} />}
                onClick={() => deleteNode()}
              >
                {t("Remove from page")}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      </div>
      <DatabaseView
        databaseId={database.id}
        spaceId={database.spaceId}
        spaceSlug={spaceSlug}
        initialViewId={viewId ?? undefined}
        embedId={embedId ?? undefined}
        pageId={pageId}
      />
    </>
  );
}

function Placeholder({
  icon,
  label,
  onRemove,
  removeLabel,
}: {
  icon: React.ReactNode;
  label: string;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <div className={classes.placeholder}>
      <span className={classes.placeholderIcon}>{icon}</span>
      <span>{label}</span>
      {onRemove && (
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          ml="auto"
          onClick={onRemove}
          aria-label={removeLabel}
        >
          <IconTrash size={14} />
        </ActionIcon>
      )}
    </div>
  );
}

function ErrorPlaceholder() {
  const { t } = useTranslation();
  return (
    <Placeholder
      icon={<IconAlertTriangle size={18} stroke={1.6} />}
      label={t("Failed to load this database")}
    />
  );
}
