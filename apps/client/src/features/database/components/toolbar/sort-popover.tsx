import { useEffect, useMemo, useRef } from "react";
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
import { titleFilterProperty } from "@/features/database/filters/title-filter.ts";

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
  // Property ids already used by other sort rows; excluded here so the same
  // column cannot be sorted on twice.
  usedByOthers: Set<string>;
  onChange: (next: ISortCondition) => void;
  onRemove: () => void;
  onReorder: (from: number, to: number) => void;
}

function SortRow({
  index,
  properties,
  sort,
  usedByOthers,
  onChange,
  onRemove,
  onReorder,
}: SortRowProps) {
  const { t } = useTranslation();
  const handleRef = useRef<HTMLButtonElement | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  // onReorder is a fresh closure every render (the parent rebuilds it from the
  // current sorts). Embed views re-render frequently, so if it were an effect
  // dep the adapter would tear down and re-register every render and a re-render
  // landing mid-drag would abort the drop (#85 pattern). Read it through a ref
  // so the adapter registers once per index and always calls the latest.
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

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
          if (typeof from === "number") onReorderRef.current(from, index);
        },
      }),
    );
    // Deps limited to `index` — the only value that changes WHICH row this is.
    // onReorder is read through a ref so the adapter survives re-renders (#85).
  }, [index]);

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
        data={properties
          .filter((p) => !usedByOthers.has(p.id))
          .map((p) => ({ value: p.id, label: p.name }))}
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
  // Title is sortable too, via a synthetic text property prepended to the list
  // (not a real database property, so it has no grid column).
  const allProperties = useMemo(
    () => [titleFilterProperty(t("Title")), ...properties],
    [properties, t],
  );

  const used = new Set(sorts.map((s) => s.propertyId));
  // Nothing left to add once every property is already a sort condition; a
  // column may only appear once.
  const hasUnusedProperty = allProperties.some((p) => !used.has(p.id));

  function addSort() {
    // Default a new sort to the first unused real property (Title is a choice,
    // not the default); fall back to Title only when every property is taken.
    const next =
      properties.find((p) => !used.has(p.id)) ??
      allProperties.find((p) => !used.has(p.id));
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
          properties={allProperties}
          sort={sort}
          usedByOthers={
            new Set(
              sorts
                .filter((_, i) => i !== index)
                .map((s) => s.propertyId),
            )
          }
          onChange={(next) => patch(index, next)}
          onRemove={() => remove(index)}
          onReorder={(from, to) => onChange(moveSort(sorts, from, to))}
        />
      ))}
      {hasUnusedProperty && (
        <Button
          variant="subtle"
          size="xs"
          onClick={addSort}
          style={{ alignSelf: "flex-start" }}
        >
          {t("Add sort")}
        </Button>
      )}
    </Stack>
  );
}

export default SortPopover;
