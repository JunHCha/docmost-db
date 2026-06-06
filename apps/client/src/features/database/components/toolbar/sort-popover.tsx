import { useEffect, useRef } from "react";
import { ActionIcon, Button, Group, Select, Stack, Text } from "@mantine/core";
import { IconGripVertical, IconX } from "@tabler/icons-react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { useTranslation } from "react-i18next";
import {
  IDatabaseProperty,
  ISortCondition,
} from "@/features/database/types/database.types.ts";

// Pure list reorder: remove the item at `from` and insert it at `to`. The sort
// list order is the tie-break priority (top = highest), so moving a row updates
// priority. Kept side-effect free so it is unit-testable without a real drag.
export function moveSort(
  sorts: ISortCondition[],
  from: number,
  to: number,
): ISortCondition[] {
  if (from === to) return sorts;
  const next = [...sorts];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

interface SortPopoverProps {
  properties: IDatabaseProperty[];
  sorts: ISortCondition[];
  onChange: (sorts: ISortCondition[]) => void;
}

interface SortRowProps {
  index: number;
  properties: IDatabaseProperty[];
  sort: ISortCondition;
  onChange: (next: ISortCondition) => void;
  onRemove: () => void;
  onReorder: (from: number, to: number) => void;
}

function SortRow({
  index,
  properties,
  sort,
  onChange,
  onRemove,
  onReorder,
}: SortRowProps) {
  const { t } = useTranslation();
  const handleRef = useRef<HTMLButtonElement | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handle = handleRef.current;
    const row = rowRef.current;
    if (!handle || !row) return;
    return combine(
      draggable({ element: handle, getInitialData: () => ({ index }) }),
      dropTargetForElements({
        element: row,
        getData: () => ({ index }),
        onDrop: ({ source }) => {
          const from = source.data.index as number;
          if (typeof from === "number") onReorder(from, index);
        },
      }),
    );
  }, [index, onReorder]);

  return (
    <Group ref={rowRef} gap="xs" wrap="nowrap" align="center">
      <ActionIcon
        ref={handleRef}
        variant="subtle"
        color="gray"
        aria-label={t("Reorder sort")}
        style={{ cursor: "grab" }}
      >
        <IconGripVertical size={16} />
      </ActionIcon>
      <Select
        aria-label={t("Sort property")}
        data={properties.map((p) => ({ value: p.id, label: p.name }))}
        value={sort.propertyId}
        onChange={(v) => v && onChange({ ...sort, propertyId: v })}
        comboboxProps={{ withinPortal: false }}
        size="xs"
        w={130}
      />
      <Select
        aria-label={t("Sort direction")}
        data={[
          { value: "asc", label: t("Ascending") },
          { value: "desc", label: t("Descending") },
        ]}
        value={sort.direction}
        onChange={(v) =>
          v && onChange({ ...sort, direction: v as ISortCondition["direction"] })
        }
        comboboxProps={{ withinPortal: false }}
        size="xs"
        w={110}
      />
      <ActionIcon
        variant="subtle"
        color="gray"
        aria-label={t("Remove sort")}
        onClick={onRemove}
      >
        <IconX size={16} />
      </ActionIcon>
    </Group>
  );
}

// Sort builder body: an ordered list of sort rows (list order = tie-break
// priority) plus an Add sort action. Rows reorder by dragging the grip handle.
export function SortPopover({ properties, sorts, onChange }: SortPopoverProps) {
  const { t } = useTranslation();

  function addSort() {
    const used = new Set(sorts.map((s) => s.propertyId));
    const next = properties.find((p) => !used.has(p.id)) ?? properties[0];
    if (!next) return;
    onChange([...sorts, { propertyId: next.id, direction: "asc" }]);
  }

  function patch(index: number, next: ISortCondition) {
    onChange(sorts.map((s, i) => (i === index ? next : s)));
  }

  function remove(index: number) {
    onChange(sorts.filter((_, i) => i !== index));
  }

  return (
    <Stack gap="xs" miw={260}>
      <Text size="sm" fw={600}>
        {t("Sort")}
      </Text>
      {sorts.map((sort, index) => (
        <SortRow
          key={index}
          index={index}
          properties={properties}
          sort={sort}
          onChange={(next) => patch(index, next)}
          onRemove={() => remove(index)}
          onReorder={(from, to) => onChange(moveSort(sorts, from, to))}
        />
      ))}
      <Button
        variant="subtle"
        size="xs"
        onClick={addSort}
        style={{ alignSelf: "flex-start" }}
      >
        {t("Add sort")}
      </Button>
    </Stack>
  );
}

export default SortPopover;
