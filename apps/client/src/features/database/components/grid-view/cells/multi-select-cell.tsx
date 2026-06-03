import { useState } from "react";
import {
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
import { OptionPill } from "@/features/database/components/property/option-pill.tsx";
import { CellProps } from "./cell-props";

export function MultiSelectCell({
  property,
  value,
  pageId,
  databaseId,
}: CellProps) {
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
  const selectedIds: string[] = Array.isArray(value?.value) ? value.value : [];
  const selectedOptions = selectedIds
    .map((id) => options.find((o) => o.id === id))
    .filter((o): o is NonNullable<typeof o> => !!o);

  function commit(nextIds: string[]) {
    if (nextIds.length === 0) {
      clearValue.mutate({ pageId, propertyId: property.id });
    } else {
      setValue.mutate({
        pageId,
        propertyId: property.id,
        value: { type: "multi_select", value: nextIds },
      });
    }
  }

  function toggle(optionId: string) {
    setSearch("");
    const next = selectedIds.includes(optionId)
      ? selectedIds.filter((id) => id !== optionId)
      : [...selectedIds, optionId];
    commit(next);
  }

  async function createAndAdd() {
    const label = search.trim();
    if (!label) return;
    setSearch("");
    // Full-replace echo: keep every existing option (with id), append the new.
    const { options: nextOptions, newOptionId } = appendOption(options, label);
    // Persist the option before adding it: the backend rejects a multi_select
    // value whose id is not yet present in config.options (assertOptionId).
    await updateProperty.mutateAsync({
      propertyId: property.id,
      config: { options: nextOptions },
    });
    commit([...selectedIds, newOptionId]);
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
        if (val === "$create") return createAndAdd();
        toggle(val);
      }}
    >
      <Combobox.Target>
        <UnstyledButton
          aria-label={property.name}
          onClick={() => combobox.toggleDropdown()}
          style={{ width: "100%", minHeight: 20, textAlign: "left" }}
        >
          <Group gap={4}>
            {selectedOptions.map((o) => (
              <OptionPill key={o.id} color={o.color} label={o.label} />
            ))}
          </Group>
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
                  <Group gap="xs" justify="space-between">
                    <OptionPill color={o.color} label={o.label} />
                    {selectedIds.includes(o.id) && <Text size="xs">✓</Text>}
                  </Group>
                </Combobox.Option>
              ))}
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

export default MultiSelectCell;
