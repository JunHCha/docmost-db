import { useState } from "react";
import { Badge, Button, Group, Popover } from "@mantine/core";
import { IconArrowsSort, IconFilter } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  IDatabaseProperty,
  IFilterCondition,
  ISortCondition,
} from "@/features/database/types/database.types.ts";
import { FilterPopover } from "./filter-popover";
import { SortPopover } from "./sort-popover";

interface ViewToolbarProps {
  properties: IDatabaseProperty[];
  filters: IFilterCondition[];
  sorts: ISortCondition[];
  onFiltersChange: (filters: IFilterCondition[]) => void;
  onSortsChange: (sorts: ISortCondition[]) => void;
}

function CountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Badge size="xs" circle variant="filled">
      {count}
    </Badge>
  );
}

// View options toolbar: Filter / Sort buttons, each opening a builder popover,
// with a badge showing the active condition count (hidden when zero).
export function ViewToolbar({
  properties,
  filters,
  sorts,
  onFiltersChange,
  onSortsChange,
}: ViewToolbarProps) {
  const { t } = useTranslation();
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  return (
    <Group gap="xs">
      <Popover
        opened={filterOpen}
        onChange={setFilterOpen}
        position="bottom-end"
        withinPortal={false}
        shadow="md"
        trapFocus={false}
      >
        <Popover.Target>
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconFilter size={16} />}
            rightSection={<CountBadge count={filters.length} />}
            onClick={() => setFilterOpen((o) => !o)}
          >
            {t("Filter")}
          </Button>
        </Popover.Target>
        <Popover.Dropdown>
          <FilterPopover
            properties={properties}
            filters={filters}
            onChange={onFiltersChange}
          />
        </Popover.Dropdown>
      </Popover>
      <Popover
        opened={sortOpen}
        onChange={setSortOpen}
        position="bottom-end"
        withinPortal={false}
        shadow="md"
        trapFocus={false}
      >
        <Popover.Target>
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconArrowsSort size={16} />}
            rightSection={<CountBadge count={sorts.length} />}
            onClick={() => setSortOpen((o) => !o)}
          >
            {t("Sort")}
          </Button>
        </Popover.Target>
        <Popover.Dropdown>
          <SortPopover
            properties={properties}
            sorts={sorts}
            onChange={onSortsChange}
          />
        </Popover.Dropdown>
      </Popover>
    </Group>
  );
}

export default ViewToolbar;
