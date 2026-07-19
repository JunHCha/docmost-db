import { ActionIcon, Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  IDatabaseProperty,
  IViewColumnConfig,
} from "@/features/database/types/database.types.ts";
import { PropertyTypeIcon } from "../property/property-type-icon";
import classes from "./toolbar.module.css";

interface PropertiesPopoverProps {
  properties: IDatabaseProperty[];
  columns: IViewColumnConfig[] | undefined;
  onToggle: (propertyId: string, visible: boolean) => void;
}

// Properties body: one row per property with an eye icon toggling its
// visibility in the active view (open eye = shown, crossed eye = hidden). A
// property absent from the view config defaults to shown (legacy/empty configs).
// The title column isn't a property, so it never lists here and stays locked on.
// Each row leads with the property's type icon (#4) so the list mirrors the
// glyphs shown on cards and column headers. Padded to match the filter/sort
// builder popovers (classes.popover); the "Show properties" title lives on the
// menu trigger, so the body carries no duplicate header.
export function PropertiesPopover({
  properties,
  columns,
  onToggle,
}: PropertiesPopoverProps) {
  const { t } = useTranslation();
  const config = new Map((columns ?? []).map((c) => [c.propertyId, c]));

  return (
    <Stack gap={4} className={classes.popover} p={6}>
      {properties.map((property) => {
        const visible = config.get(property.id)?.visible !== false;
        return (
          <Group
            key={property.id}
            justify="space-between"
            wrap="nowrap"
            gap="md"
          >
            <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
              <PropertyTypeIcon type={property.type} size={14} />
              <Text size="sm" truncate c={visible ? undefined : "dimmed"}>
                {property.name}
              </Text>
            </Group>
            <Tooltip label={visible ? t("Hide") : t("Show")} withArrow>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label={property.name}
                aria-pressed={visible}
                onClick={() => onToggle(property.id, !visible)}
              >
                {visible ? <IconEye size={16} /> : <IconEyeOff size={16} />}
              </ActionIcon>
            </Tooltip>
          </Group>
        );
      })}
    </Stack>
  );
}

export default PropertiesPopover;
