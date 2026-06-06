import { useState } from "react";
import { ActionIcon, Group, Popover, Tooltip } from "@mantine/core";
import { IconArrowsSort, IconFilter } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  IDatabaseProperty,
  IFilterCondition,
  ISortCondition,
  IViewColumnConfig,
} from "@/features/database/types/database.types.ts";
import { FilterPopover } from "./filter-popover";
import { SortPopover } from "./sort-popover";
import { ViewSettingsMenu } from "./view-settings-menu";

interface ViewToolbarProps {
  viewType: string;
  properties: IDatabaseProperty[];
  filters: IFilterCondition[];
  sorts: ISortCondition[];
  columns?: IViewColumnConfig[];
  onFiltersChange: (filters: IFilterCondition[]) => void;
  onSortsChange: (sorts: ISortCondition[]) => void;
  onToggleColumn: (propertyId: string, visible: boolean) => void;
  groupByPropertyId?: string;
  onChangeGroupBy?: (id: string | null) => void;
}

// View options toolbar: icon-only Filter / Sort buttons (each opening a builder
// popover) and a View settings menu. A tool turns blue when it has non-default
// settings (active) and stays gray (dimmed) otherwise; a Tooltip + aria-label
// keep the icon buttons accessible.
export function ViewToolbar({
  viewType,
  properties,
  filters,
  sorts,
  columns,
  onFiltersChange,
  onSortsChange,
  onToggleColumn,
  groupByPropertyId,
  onChangeGroupBy,
}: ViewToolbarProps) {
  const { t } = useTranslation();
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const filterActive = filters.length > 0;
  const sortActive = sorts.length > 0;
  const settingsActive =
    (columns ?? []).some((c) => c.visible === false) ||
    (viewType === "board" && !!groupByPropertyId);

  return (
    <Group gap="xs">
      <Popover
        opened={filterOpen}
        onChange={setFilterOpen}
        position="bottom-end"
        withinPortal={false}
        shadow="md"
        trapFocus={false}
        // Value widgets (e.g. the date picker) render their own popups; a click
        // inside one would otherwise read as an outside click and close the
        // builder mid-edit. Only the toggle button / explicit close dismiss it.
        closeOnClickOutside={false}
      >
        <Popover.Target>
          <Tooltip label={t("Filter")}>
            <ActionIcon
              variant="subtle"
              color={filterActive ? "blue" : "gray"}
              aria-label={t("Filter")}
              onClick={() => setFilterOpen((o) => !o)}
            >
              <IconFilter size={16} />
            </ActionIcon>
          </Tooltip>
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
        closeOnClickOutside={false}
      >
        <Popover.Target>
          <Tooltip label={t("Sort")}>
            <ActionIcon
              variant="subtle"
              color={sortActive ? "blue" : "gray"}
              aria-label={t("Sort")}
              onClick={() => setSortOpen((o) => !o)}
            >
              <IconArrowsSort size={16} />
            </ActionIcon>
          </Tooltip>
        </Popover.Target>
        <Popover.Dropdown>
          <SortPopover
            properties={properties}
            sorts={sorts}
            onChange={onSortsChange}
          />
        </Popover.Dropdown>
      </Popover>
      <ViewSettingsMenu
        viewType={viewType}
        properties={properties}
        columns={columns}
        active={settingsActive}
        onToggleColumn={onToggleColumn}
        groupByPropertyId={groupByPropertyId}
        onChangeGroupBy={onChangeGroupBy}
      />
    </Group>
  );
}

export default ViewToolbar;
