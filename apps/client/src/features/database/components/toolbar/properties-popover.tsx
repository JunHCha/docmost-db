import { Group, Stack, Switch, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  IDatabaseProperty,
  IViewColumnConfig,
} from "@/features/database/types/database.types.ts";

interface PropertiesPopoverProps {
  properties: IDatabaseProperty[];
  columns: IViewColumnConfig[] | undefined;
  onToggle: (propertyId: string, visible: boolean) => void;
}

// Properties body: one row per property with a switch toggling its visibility
// in the active view. A property absent from the view config defaults to shown
// (legacy/empty configs). The title column isn't a property, so it never lists
// here and stays locked on.
export function PropertiesPopover({
  properties,
  columns,
  onToggle,
}: PropertiesPopoverProps) {
  const { t } = useTranslation();
  const config = new Map((columns ?? []).map((c) => [c.propertyId, c]));

  return (
    <Stack gap="xs" miw={220}>
      <Text size="xs" c="dimmed">
        {t("Shown in view")}
      </Text>
      {properties.map((property) => {
        const visible = config.get(property.id)?.visible !== false;
        return (
          <Group key={property.id} justify="space-between" wrap="nowrap">
            <Text size="sm">{property.name}</Text>
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
