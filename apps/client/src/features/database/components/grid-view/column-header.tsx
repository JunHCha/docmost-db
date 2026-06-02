import { useEffect, useRef, useState } from "react";
import { Group, Menu, ActionIcon, Text, TextInput, Select } from "@mantine/core";
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
  const ref = useRef<HTMLDivElement>(null);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(property.name);

  const reorder = useReorderPropertyMutation(databaseId);
  const update = useUpdatePropertyMutation(databaseId);
  const remove = useDeletePropertyMutation(databaseId);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return combine(
      draggable({
        element: el,
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
            orderedProperties,
          );
          if (!target) return;
          reorder.mutate({
            propertyId: sourceId,
            afterPropertyId: target.afterPropertyId,
          });
        },
      }),
    );
  }, [property.id, orderedProperties, reorder]);

  function commitRename() {
    setRenaming(false);
    const next = nameDraft.trim();
    if (next && next !== property.name) {
      update.mutate({ propertyId: property.id, name: next });
    }
  }

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <Group justify="space-between" gap={4} wrap="nowrap">
        {renaming ? (
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
          <Text size="sm" fw={500} truncate>
            {property.name}
          </Text>
        )}
        <Menu
          position="bottom-end"
          withinPortal={false}
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
            <Menu.Item
              onClick={() => {
                setNameDraft(property.name);
                setRenaming(true);
              }}
            >
              {t("Rename")}
            </Menu.Item>
            <Menu.Label>{t("Type")}</Menu.Label>
            <div style={{ padding: "0 8px 8px" }}>
              <Select
                size="xs"
                data={TYPE_OPTIONS}
                value={property.type}
                aria-label={t("Property type")}
                onChange={(value) => {
                  if (value && value !== property.type) {
                    update.mutate({
                      propertyId: property.id,
                      type: value as PropertyType,
                    });
                  }
                }}
              />
            </div>
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
