import { useState } from "react";
import {
  Badge,
  Combobox,
  Group,
  Text,
  UnstyledButton,
  useCombobox,
} from "@mantine/core";
import {
  useClearValueMutation,
  useSetValueMutation,
  useUpdatePropertyMutation,
} from "@/features/database/queries/database-query.ts";
import {
  appendOption,
  getOptions,
} from "@/features/database/components/property/option-config.ts";
import { resolveOptionColor } from "@/features/database/components/property/option-colors.ts";
import { CellProps } from "./cell-props";

export function SelectCell({ property, value, pageId, databaseId }: CellProps) {
  const setValue = useSetValueMutation(databaseId);
  const clearValue = useClearValueMutation(databaseId);
  const updateProperty = useUpdatePropertyMutation(databaseId);
  const [opened, setOpened] = useState(false);
  const combobox = useCombobox({
    opened,
    onDropdownClose: () => setOpened(false),
    onDropdownOpen: () => setOpened(true),
  });
  const [search, setSearch] = useState("");

  const options = getOptions(property.config);
  const selectedId = typeof value?.value === "string" ? value.value : "";
  const selected = options.find((o) => o.id === selectedId);

  function select(optionId: string) {
    combobox.closeDropdown();
    setSearch("");
    setValue.mutate({
      pageId,
      propertyId: property.id,
      value: { type: "select", value: optionId },
    });
  }

  function clear() {
    combobox.closeDropdown();
    setSearch("");
    clearValue.mutate({ pageId, propertyId: property.id });
  }

  function createAndSelect() {
    const label = search.trim();
    if (!label) return;
    // Full-replace echo: send every existing option (with id) plus the new one.
    const { options: next, newOptionId } = appendOption(options, label);
    updateProperty.mutate({ propertyId: property.id, config: { options: next } });
    select(newOptionId);
  }

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const exactMatch = options.some(
    (o) => o.label.toLowerCase() === search.trim().toLowerCase(),
  );

  return (
    <Combobox
      store={combobox}
      withinPortal={false}
      onOptionSubmit={(val) => {
        if (val === "$clear") return clear();
        if (val === "$create") return createAndSelect();
        select(val);
      }}
    >
      <Combobox.Target>
        <UnstyledButton
          aria-label={property.name}
          onClick={() => combobox.toggleDropdown()}
          style={{ width: "100%", minHeight: 20, textAlign: "left" }}
        >
          {selected ? (
            <Badge
              color={resolveOptionColor(selected.color)}
              variant="light"
              radius="sm"
            >
              {selected.label}
            </Badge>
          ) : (
            <Text size="sm" c="dimmed">
              {""}
            </Text>
          )}
        </UnstyledButton>
      </Combobox.Target>
      <Combobox.Dropdown>
        <Combobox.Search
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          placeholder="Search or create..."
        />
        <Combobox.Options>
          {opened && (
            <>
              {filtered.map((o) => (
                <Combobox.Option value={o.id} key={o.id}>
                  <Group gap="xs">
                    <Badge
                      color={resolveOptionColor(o.color)}
                      variant="light"
                      radius="sm"
                    >
                      {o.label}
                    </Badge>
                  </Group>
                </Combobox.Option>
              ))}
              {selected && (
                <Combobox.Option value="$clear">
                  <Text size="sm" c="dimmed">
                    Clear
                  </Text>
                </Combobox.Option>
              )}
              {search.trim() && !exactMatch && (
                <Combobox.Option value="$create">
                  <Text size="sm">{`Create "${search.trim()}"`}</Text>
                </Combobox.Option>
              )}
            </>
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}

export default SelectCell;
