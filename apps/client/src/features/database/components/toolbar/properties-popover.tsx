import { Group, Stack, Switch, Text } from "@mantine/core";
import { IconEye } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  IDatabaseProperty,
  IViewColumnConfig,
} from "@/features/database/types/database.types.ts";
import { PropertyTypeIcon } from "../property/property-type-icon";

interface PropertiesPopoverProps {
  properties: IDatabaseProperty[];
  columns: IViewColumnConfig[] | undefined;
  onToggle: (propertyId: string, visible: boolean) => void;
}

// Properties body: one row per property with a switch toggling its visibility
// in the active view. A property absent from the view config defaults to shown
// (legacy/empty configs). The title column isn't a property, so it never lists
// here and stays locked on. Each row leads with the property's type icon (#4)
// so the list mirrors the glyphs shown on cards and column headers.
export function PropertiesPopover({
  properties,
  columns,
  onToggle,
}: PropertiesPopoverProps) {
  const { t } = useTranslation();
  const config = new Map((columns ?? []).map((c) => [c.propertyId, c]));

  return (
    <Stack gap="xs" miw={220}>
      <Group gap={6} wrap="nowrap" c="dimmed">
        <IconEye size={14} />
        <Text size="xs" fw={600}>
          {t("Show properties")}
        </Text>
      </Group>
      {properties.map((property) => {
        const visible = config.get(property.id)?.visible !== false;
        return (
          <Group key={property.id} justify="space-between" wrap="nowrap">
            <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
              <PropertyTypeIcon type={property.type} size={14} />
              <Text size="sm" truncate>
                {property.name}
              </Text>
            </Group>
            <Switch
              size="xs"
              aria-label={property.name}
              checked={visible}
              onChange={() => onToggle(property.id, !visible)}
            />
          </Group>
        );
      })}
    </Stack>
  );
}

export default PropertiesPopover;
