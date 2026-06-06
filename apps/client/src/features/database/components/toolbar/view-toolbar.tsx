import { useState } from "react";
import { Badge, Button, Group, Popover } from "@mantine/core";
import { IconArrowsSort, IconFilter, IconColumns3 } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  IDatabaseProperty,
  IFilterCondition,
  ISortCondition,
  IViewColumnConfig,
} from "@/features/database/types/database.types.ts";
import { FilterPopover } from "./filter-popover";
import { SortPopover } from "./sort-popover";
import { PropertiesPopover } from "./properties-popover";

interface ViewToolbarProps {
  properties: IDatabaseProperty[];
  filters: IFilterCondition[];
  sorts: ISortCondition[];
  columns?: IViewColumnConfig[];
  onFiltersChange: (filters: IFilterCondition[]) => void;
  onSortsChange: (sorts: ISortCondition[]) => void;
  onToggleColumn: (propertyId: string, visible: boolean) => void;
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
  columns,
  onFiltersChange,
  onSortsChange,
  onToggleColumn,
}: ViewToolbarProps) {
  const { t } = useTranslation();
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(false);

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
      <Popover
        opened={propertiesOpen}
        onChange={setPropertiesOpen}
        position="bottom-end"
        withinPortal={false}
        shadow="md"
        trapFocus={false}
      >
        <Popover.Target>
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconColumns3 size={16} />}
            onClick={() => setPropertiesOpen((o) => !o)}
          >
            {t("Properties")}
          </Button>
        </Popover.Target>
        <Popover.Dropdown>
          <PropertiesPopover
            properties={properties}
            columns={columns}
            onToggle={onToggleColumn}
          />
        </Popover.Dropdown>
      </Popover>
    </Group>
  );
}

export default ViewToolbar;
