import { useEffect, useRef, useState } from "react";
import { Group, Menu, ActionIcon, Text, TextInput } from "@mantine/core";
import { IconArrowsLeftRight, IconGripVertical } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
  attachClosestEdge,
  extractClosestEdge,
  type Edge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import {
  IDatabaseProperty,
  PropertyType,
} from "@/features/database/types/database.types.ts";
import {
  useDeletePropertyMutation,
  useListDatabasesQuery,
  useUpdatePropertyMutation,
} from "@/features/database/queries/database-query.ts";
import { resolveReorderTarget } from "./reorder";
import { ColumnResizeHandle } from "./column-resize-handle";
import classes from "./column-header.module.css";
import tableClasses from "./table-view.module.css";
import { getOptions } from "@/features/database/components/property/option-config.ts";

// Isolate column DnD from the page tree's drag adapter.
const COLUMN_DRAG = Symbol("database-column");

const TYPE_OPTIONS: { value: PropertyType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "checkbox", label: "Checkbox" },
  { value: "url", label: "URL" },
  { value: "date", label: "Date" },
  { value: "select", label: "Select" },
  { value: "multi_select", label: "Multi-select" },
  { value: "relation", label: "Relation" },
];

interface ColumnHeaderProps {
  property: IDatabaseProperty;
  databaseId: string;
  spaceId: string;
  orderedProperties: IDatabaseProperty[];
  // Active-view column config: current width (px) plus persistence callbacks.
  // Resize previews locally and commits once on pointer-up; hide commits
  // immediately. Both are owned by TableView (full-config echo, see view-columns).
  width: number;
  onHide: () => void;
  onResize: (width: number) => void;
  // Reorder this view's columns (#92): move `propertyId` to just after
  // `afterPropertyId` (undefined => front). The order is view-scoped via the
  // view config draft, no longer a global property.position mutation.
  onReorder: (propertyId: string, afterPropertyId: string | undefined) => void;
}

export function ColumnHeader({
  property,
  databaseId,
  spaceId,
  orderedProperties,
  width,
  onHide,
  onResize,
  onReorder,
}: ColumnHeaderProps) {
  const { t } = useTranslation();
  const dragRef = useRef<HTMLDivElement>(null);
  // Drag is initiated only from this grip (not the whole header), so plain
  // clicks on the name/options don't start a drag. The drop target stays the
  // full header (see dropTargetForElements) so columns can be dropped anywhere.
  const gripRef = useRef<HTMLButtonElement>(null);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(property.name);
  // Swaps the type menu for a target-database picker (relation needs a
  // targetDatabaseId, otherwise the server rejects the update with 400).
  const [pickingRelation, setPickingRelation] = useState(false);

  const update = useUpdatePropertyMutation(databaseId);
  // The drag adapter must register ONCE and stay alive: the onReorder callback
  // and the orderedProperties array change identity on re-render, and Phase 3/4
  // realtime updates re-render the table constantly. If those were useEffect
  // deps, a re-render landing mid-drag would tear down the adapter and abort the
  // native drag, so the drop never fires (#85). We read the live values through
  // refs instead and keep the effect deps to the stable property id.
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;
  const orderedRef = useRef(orderedProperties);
  orderedRef.current = orderedProperties;
  const remove = useDeletePropertyMutation(databaseId);
  const { data: databases } = useListDatabasesQuery(spaceId);
  const currentTargetId =
    property.type === "relation" &&
    typeof property.config?.targetDatabaseId === "string"
      ? property.config.targetDatabaseId
      : undefined;

  useEffect(() => {
    // The draggable wrapper only exists in the non-editing view (see render),
    // so `dragRef.current` is null while renaming and registration is skipped.
    // Keeping the rename input OUTSIDE the drag element is deliberate: the drag
    // adapter sets a `draggable="true"` attribute that makes the browser hijack
    // pointer interactions (caret placement, text selection, focus) inside any
    // descendant input. `renaming` stays in the deps so the adapter re-registers
    // once editing ends and the wrapper remounts.
    const el = dragRef.current;
    if (!el || renaming) return;
    return combine(
      draggable({
        element: el,
        // Restrict drag initiation to the grip handle; the whole header stays a
        // drop target. Falls back to the whole element if the grip isn't mounted.
        dragHandle: gripRef.current ?? undefined,
        getInitialData: () => ({ id: property.id, context: COLUMN_DRAG }),
      }),
      dropTargetForElements({
        element: el,
        canDrop: ({ source }) =>
          source.data.context === COLUMN_DRAG && source.data.id !== property.id,
        getData: ({ input, element }) =>
          attachClosestEdge(
            { id: property.id, context: COLUMN_DRAG },
            { input, element, allowedEdges: ["left", "right"] },
          ),
        onDrag: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setClosestEdge(null),
        onDrop: ({ self, source }) => {
          setClosestEdge(null);
          const edge = extractClosestEdge(self.data);
          if (!edge) return;
          const sourceId = source.data.id as string;
          const target = resolveReorderTarget(
            property.id,
            edge,
            orderedRef.current,
            sourceId,
          );
          // null means an unknown target or an in-place drop, so skip.
          if (!target) return;
          onReorderRef.current(sourceId, target.afterPropertyId);
        },
      }),
    );
    // Deps are limited to values that change WHICH element/whether we register:
    // the column id and the renaming toggle (the wrapper unmounts while editing).
    // orderedProperties/reorder are read through refs so the adapter survives the
    // frequent re-renders from realtime updates (#85).
  }, [property.id, renaming]);

  function startRename() {
    setNameDraft(property.name);
    setRenaming(true);
  }

  function commitRename() {
    setRenaming(false);
    const next = nameDraft.trim();
    if (next && next !== property.name) {
      update.mutate({ propertyId: property.id, name: next });
    }
  }

  return (
    // No position:relative here: the handle and drop indicator anchor to the
    // enclosing Table.Th (which is position:relative; padding:0), so they land
    // on the cell's actual right border — the column divider — instead of being
    // inset by the cell padding (issue #15). The cell padding lives on the inner
    // content wrapper instead.
    <>
      <div className={tableClasses.headerCellContent}>
        {renaming ? (
          // Rendered outside the draggable wrapper so the drag adapter cannot
          // intercept typing/caret placement. The menu is unmounted while editing,
          // so there is no focus-return race against the autofocused input.
          <TextInput
            autoFocus
            size="xs"
            variant="unstyled"
            value={nameDraft}
            aria-label={t("Rename column")}
            onChange={(e) => setNameDraft(e.currentTarget.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setRenaming(false);
            }}
          />
        ) : (
          <div ref={dragRef} className={classes.headerInner}>
            <Group gap={4} wrap="nowrap">
              <ActionIcon
                ref={gripRef}
                size="xs"
                variant="subtle"
                color="gray"
                className={`${classes.handle} ${classes.grip}`}
                aria-label={t("Drag to reorder column")}
              >
                <IconGripVertical size={14} />
              </ActionIcon>
              {property.type === "relation" && (
                <IconArrowsLeftRight
                  size={13}
                  stroke={1.8}
                  color="var(--mantine-color-dimmed)"
                  aria-label={t("Relation")}
                  style={{ flexShrink: 0 }}
                />
              )}
              <Text
                size="sm"
                fw={500}
                truncate
                style={{ flex: 1, cursor: "text" }}
                onDoubleClick={startRename}
              >
                {property.name}
              </Text>
              <Menu
                position="bottom-end"
                shadow="md"
                // Portal (Mantine default) so the dropdown escapes the grid's
                // overflow-x scroll container — inline rendering got clipped and
                // caused a scroll-snap glitch when the table was short.
                returnFocus={false}
                transitionProps={{ duration: 0 }}
                onClose={() => setPickingRelation(false)}
              >
                <Menu.Target>
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="gray"
                    className={classes.handle}
                    aria-label={t("Column options")}
                  >
                    ⋯
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  {pickingRelation ? (
                    // Relation target picker: list the space's other databases.
                    // Committing without a targetDatabaseId is rejected (400),
                    // so the type change only fires once a target is chosen.
                    <>
                      <Menu.Label>{t("Relation to")}</Menu.Label>
                      {(databases ?? [])
                        .filter((db) => db.id !== databaseId)
                        .map((db) => (
                          <Menu.Item
                            key={db.id}
                            leftSection={
                              <span
                                style={{ display: "inline-block", width: 12 }}
                              >
                                {db.id === currentTargetId ? "✓" : ""}
                              </span>
                            }
                            onClick={() => {
                              setPickingRelation(false);
                              if (db.id === currentTargetId) return;
                              update.mutate({
                                propertyId: property.id,
                                type: "relation",
                                config: { targetDatabaseId: db.id },
                              });
                            }}
                          >
                            {db.title || t("Untitled")}
                          </Menu.Item>
                        ))}
                    </>
                  ) : (
                    <>
                      <Menu.Item onClick={startRename}>{t("Rename")}</Menu.Item>
                      <Menu.Item onClick={onHide}>{t("Hide column")}</Menu.Item>
                      {property.type === "relation" && (
                        <Menu.Item
                          closeMenuOnClick={false}
                          leftSection={<IconArrowsLeftRight size={14} />}
                          onClick={() => setPickingRelation(true)}
                        >
                          {t("Change relation target")}
                        </Menu.Item>
                      )}
                      <Menu.Label>{t("Type")}</Menu.Label>
                      {/* Each type is a Menu.Item, not a nested <Select>: a Select
                        renders its options in a portal, and clicking one counts
                        as an outside-click that closes this Menu and unmounts
                        the Select before its onChange commits — so the type
                        never actually changed. Menu.Item clicks commit. */}
                      {TYPE_OPTIONS.map((opt) => (
                        <Menu.Item
                          key={opt.value}
                          closeMenuOnClick={opt.value !== "relation"}
                          leftSection={
                            <span
                              style={{ display: "inline-block", width: 12 }}
                            >
                              {opt.value === property.type ? "✓" : ""}
                            </span>
                          }
                          onClick={() => {
                            // Relation needs a target database, so open the
                            // picker instead of committing here.
                            if (opt.value === "relation") {
                              setPickingRelation(true);
                              return;
                            }
                            if (opt.value === property.type) return;
                            const needsOptions =
                              opt.value === "select" ||
                              opt.value === "multi_select";
                            update.mutate({
                              propertyId: property.id,
                              type: opt.value,
                              // select/multi_select require a config.options array
                              // server-side (a missing array is rejected with 400).
                              // Echo existing options — preserved when switching
                              // select↔multi_select, empty otherwise.
                              ...(needsOptions
                                ? {
                                    config: {
                                      options: getOptions(property.config),
                                    },
                                  }
                                : {}),
                            });
                          }}
                        >
                          {t(opt.label)}
                        </Menu.Item>
                      ))}
                      <Menu.Divider />
                      <Menu.Item
                        color="red"
                        onClick={() =>
                          remove.mutate({ propertyId: property.id })
                        }
                      >
                        {t("Delete")}
                      </Menu.Item>
                    </>
                  )}
                </Menu.Dropdown>
              </Menu>
            </Group>
          </div>
        )}
      </div>
      <ColumnResizeHandle width={width} onResize={onResize} />
      {closestEdge && (
        <div
          data-testid="column-drop-indicator"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            [closestEdge === "left" ? "left" : "right"]: -1,
            width: 2,
            background: "var(--mantine-color-blue-5)",
          }}
        />
      )}
    </>
  );
}

export default ColumnHeader;
