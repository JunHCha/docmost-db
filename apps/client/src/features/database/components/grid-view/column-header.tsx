import { useEffect, useRef, useState } from "react";
import { Group, Menu, ActionIcon, Text, TextInput } from "@mantine/core";
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
  useReorderPropertyMutation,
  useUpdatePropertyMutation,
} from "@/features/database/queries/database-query.ts";
import { resolveReorderTarget } from "./reorder";
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
  orderedProperties: IDatabaseProperty[];
}

export function ColumnHeader({
  property,
  databaseId,
  orderedProperties,
}: ColumnHeaderProps) {
  const { t } = useTranslation();
  const dragRef = useRef<HTMLDivElement>(null);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(property.name);

  const reorder = useReorderPropertyMutation(databaseId);
  const update = useUpdatePropertyMutation(databaseId);
  const remove = useDeletePropertyMutation(databaseId);

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
        getInitialData: () => ({ id: property.id, context: COLUMN_DRAG }),
      }),
      dropTargetForElements({
        element: el,
        canDrop: ({ source }) =>
          source.data.context === COLUMN_DRAG &&
          source.data.id !== property.id,
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
            orderedProperties,
            sourceId,
          );
          // null means an unknown target or an in-place drop (the server
          // rejects afterPropertyId === propertyId), so skip the mutation.
          if (!target) return;
          reorder.mutate({
            propertyId: sourceId,
            afterPropertyId: target.afterPropertyId,
          });
        },
      }),
    );
  }, [property.id, orderedProperties, reorder, renaming]);

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
    <div style={{ position: "relative", width: "100%" }}>
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
        <div ref={dragRef}>
          <Group justify="space-between" gap={4} wrap="nowrap">
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
              withinPortal={false}
              returnFocus={false}
              transitionProps={{ duration: 0 }}
            >
              <Menu.Target>
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  aria-label={t("Column options")}
                >
                  ⋯
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={startRename}>{t("Rename")}</Menu.Item>
                <Menu.Label>{t("Type")}</Menu.Label>
                {/* Each type is a Menu.Item, not a nested <Select>: a Select
                    renders its options in a portal, and clicking one counts
                    as an outside-click that closes this Menu and unmounts
                    the Select before its onChange commits — so the type
                    never actually changed. Menu.Item clicks commit. */}
                {TYPE_OPTIONS.map((opt) => (
                  <Menu.Item
                    key={opt.value}
                    leftSection={
                      <span style={{ display: "inline-block", width: 12 }}>
                        {opt.value === property.type ? "✓" : ""}
                      </span>
                    }
                    onClick={() => {
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
                          ? { config: { options: getOptions(property.config) } }
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
                  onClick={() => remove.mutate({ propertyId: property.id })}
                >
                  {t("Delete")}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </div>
      )}
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
    </div>
  );
}

export default ColumnHeader;
