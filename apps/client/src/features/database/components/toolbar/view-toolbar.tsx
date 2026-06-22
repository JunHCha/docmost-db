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
import { TemplateManagerMenu } from "../template-manager-menu";

interface ViewToolbarProps {
  // Owning database — needed by the template manager entry point (#91).
  databaseId: string;
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
  datePropertyId?: string;
  onChangeDateProperty?: (id: string | null) => void;
}

// View options toolbar: icon-only Filter / Sort buttons (each opening a builder
// popover) and a View settings menu. A tool turns blue when it has non-default
// settings (active) and stays gray (dimmed) otherwise; a Tooltip + aria-label
// keep the icon buttons accessible.
export function ViewToolbar({
  databaseId,
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
  datePropertyId,
  onChangeDateProperty,
}: ViewToolbarProps) {
  const { t } = useTranslation();
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const filterActive = filters.length > 0;
  const sortActive = sorts.length > 0;
  const settingsActive =
    (columns ?? []).some((c) => c.visible === false) ||
    (viewType === "board" && !!groupByPropertyId) ||
    (viewType === "calendar" && !!datePropertyId);

  return (
    <Group gap="xs">
      <Popover
        opened={filterOpen}
        onChange={setFilterOpen}
        position="bottom-end"
        withinPortal={false}
        shadow="md"
        trapFocus={false}
        // withinPortal renders the builder (and its value widgets) inside the
        // popover, so edits never count as outside clicks. The dropdown stays
        // open through editing and a filter/sort apply — only a real background
        // click dismisses it (default closeOnClickOutside).
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
        datePropertyId={datePropertyId}
        onChangeDateProperty={onChangeDateProperty}
      />
      <TemplateManagerMenu databaseId={databaseId} />
    </Group>
  );
}

export default ViewToolbar;
