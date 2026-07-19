import { ActionIcon, Menu, Tooltip } from "@mantine/core";
import { IconAdjustmentsHorizontal, IconCheck } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  IDatabaseProperty,
  IViewColumnConfig,
} from "@/features/database/types/database.types.ts";
import { groupByCandidates } from "../board-view/board-config";
import { dateCandidates } from "../calendar-view/calendar-config";
import { PropertiesPopover } from "./properties-popover";
import { PropertyTypeIcon } from "../property/property-type-icon";

interface ViewSettingsMenuProps {
  viewType: string;
  properties: IDatabaseProperty[];
  columns: IViewColumnConfig[] | undefined;
  // Trigger turns blue when the view has non-default settings (hidden columns
  // or, on a board, a group-by); the toolbar computes this and hands it in.
  active: boolean;
  onToggleColumn: (propertyId: string, visible: boolean) => void;
  groupByPropertyId?: string;
  onChangeGroupBy?: (id: string | null) => void;
  datePropertyId?: string;
  onChangeDateProperty?: (id: string | null) => void;
  endDatePropertyId?: string;
  onChangeEndDateProperty?: (id: string | null) => void;
}

// The toolbar's "View settings" control: an icon button opening a menu whose
// submenus depend on the view type. Both views get a Properties submenu (column
// show/hide); a board also gets a Group by submenu. Items keep the root menu
// open (closeOnItemClick=false) so toggling several columns needs one click.
export function ViewSettingsMenu({
  viewType,
  properties,
  columns,
  active,
  onToggleColumn,
  groupByPropertyId,
  onChangeGroupBy,
  datePropertyId,
  onChangeDateProperty,
  endDatePropertyId,
  onChangeEndDateProperty,
}: ViewSettingsMenuProps) {
  const { t } = useTranslation();
  const candidates = groupByCandidates(properties);
  const dates = dateCandidates(properties);

  // A calendar date-property submenu (used for both the start "Date" anchor and
  // the optional "End date"). Picking the already-selected property clears it,
  // so either anchor can be unset again.
  function dateSubmenu(
    label: string,
    selectedId: string | undefined,
    onChange: (id: string | null) => void,
  ) {
    return (
      <Menu.Sub>
        <Menu.Sub.Target>
          <Menu.Sub.Item>{label}</Menu.Sub.Item>
        </Menu.Sub.Target>
        <Menu.Sub.Dropdown>
          {dates.map((property) => (
            <Menu.Item
              key={property.id}
              leftSection={<PropertyTypeIcon type={property.type} size={14} />}
              rightSection={
                selectedId === property.id ? (
                  <IconCheck size={14} />
                ) : undefined
              }
              onClick={() =>
                onChange(selectedId === property.id ? null : property.id)
              }
            >
              {property.name}
            </Menu.Item>
          ))}
        </Menu.Sub.Dropdown>
      </Menu.Sub>
    );
  }

  return (
    <Menu
      closeOnItemClick={false}
      position="bottom-end"
      shadow="md"
      withinPortal={false}
    >
      <Menu.Target>
        <Tooltip label={t("View settings")}>
          <ActionIcon
            variant="subtle"
            color={active ? "blue" : "gray"}
            aria-label={t("View settings")}
          >
            <IconAdjustmentsHorizontal size={16} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Sub>
          <Menu.Sub.Target>
            <Menu.Sub.Item>{t("Show properties")}</Menu.Sub.Item>
          </Menu.Sub.Target>
          <Menu.Sub.Dropdown>
            <PropertiesPopover
              properties={properties}
              columns={columns}
              onToggle={onToggleColumn}
            />
          </Menu.Sub.Dropdown>
        </Menu.Sub>
        {viewType === "board" && onChangeGroupBy ? (
          <Menu.Sub>
            <Menu.Sub.Target>
              <Menu.Sub.Item>{t("Group by")}</Menu.Sub.Item>
            </Menu.Sub.Target>
            <Menu.Sub.Dropdown>
              {candidates.map((property) => (
                <Menu.Item
                  key={property.id}
                  leftSection={
                    <PropertyTypeIcon type={property.type} size={14} />
                  }
                  rightSection={
                    groupByPropertyId === property.id ? (
                      <IconCheck size={14} />
                    ) : undefined
                  }
                  onClick={() => onChangeGroupBy(property.id)}
                >
                  {property.name}
                </Menu.Item>
              ))}
            </Menu.Sub.Dropdown>
          </Menu.Sub>
        ) : null}
        {viewType === "calendar" && onChangeDateProperty
          ? dateSubmenu(t("Date"), datePropertyId, onChangeDateProperty)
          : null}
        {viewType === "calendar" && onChangeEndDateProperty
          ? dateSubmenu(
              t("End date"),
              endDatePropertyId,
              onChangeEndDateProperty,
            )
          : null}
      </Menu.Dropdown>
    </Menu>
  );
}

export default ViewSettingsMenu;
