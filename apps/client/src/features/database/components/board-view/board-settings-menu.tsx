import { Group, Menu, Select, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { IDatabaseProperty } from "@/features/database/types/database.types.ts";
import { groupByCandidates, toggleCardProperty } from "./board-config";

interface BoardSettingsMenuProps {
  properties: IDatabaseProperty[];
  groupByPropertyId?: string;
  cardProperties?: string[];
  onChangeGroupBy: (propertyId: string | null) => void;
  onToggleCardProperty: (next: string[]) => void;
}

// Board header controls: pick the group-by property (select/multi_select only)
// and toggle which properties show on each card. Both persist via the parent's
// updateView (config echo).
export function BoardSettingsMenu({
  properties,
  groupByPropertyId,
  cardProperties,
  onChangeGroupBy,
  onToggleCardProperty,
}: BoardSettingsMenuProps) {
  const { t } = useTranslation();
  const candidates = groupByCandidates(properties);
  // The group-by property is encoded by the column, so it's never a card chip.
  const cardChoices = properties.filter((p) => p.id !== groupByPropertyId);

  return (
    <Group gap="sm">
      <Group gap={6}>
        <Text size="sm" c="dimmed">
          {t("Group by")}
        </Text>
        <Select
          size="xs"
          aria-label={t("Group by")}
          placeholder={t("Select a property")}
          value={groupByPropertyId ?? null}
          data={candidates.map((p) => ({ value: p.id, label: p.name }))}
          onChange={onChangeGroupBy}
        />
      </Group>
      <Menu closeOnItemClick={false} position="bottom-start">
        <Menu.Target>
          <Text
            size="sm"
            c="dimmed"
            style={{ cursor: "pointer" }}
            role="button"
            aria-label={t("Card properties")}
          >
            {t("Card properties")}
          </Text>
        </Menu.Target>
        <Menu.Dropdown>
          {cardChoices.map((property) => (
            <Menu.Item
              key={property.id}
              onClick={() =>
                onToggleCardProperty(
                  toggleCardProperty(cardProperties, property.id),
                )
              }
            >
              <Group gap="xs">
                <input
                  type="checkbox"
                  readOnly
                  checked={(cardProperties ?? []).includes(property.id)}
                  aria-label={property.name}
                />
                <Text size="sm">{property.name}</Text>
              </Group>
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}

export default BoardSettingsMenu;
