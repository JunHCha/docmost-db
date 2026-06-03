import { useState } from "react";
import {
  ActionIcon,
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
  recolorOption,
  removeOption,
  renameOption,
  type SelectOption,
} from "@/features/database/components/property/option-config.ts";
import { OptionPill } from "@/features/database/components/property/option-pill.tsx";
import { OptionEditPanel } from "@/features/database/components/property/option-edit-panel.tsx";
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
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);

  const options = getOptions(property.config);
  const selectedId = typeof value?.value === "string" ? value.value : "";
  const selected = options.find((o) => o.id === selectedId);
  const editing = options.find((o) => o.id === editingOptionId) ?? null;

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

  async function createAndSelect() {
    const label = search.trim();
    if (!label) return;
    // Full-replace echo: send every existing option (with id) plus the new one.
    const { options: next, newOptionId } = appendOption(options, label);
    // Persist the option before selecting it: the backend rejects a select
    // value whose id is not yet present in config.options (assertOptionId).
    await updateProperty.mutateAsync({
      propertyId: property.id,
      config: { options: next },
    });
    select(newOptionId);
  }

  // config is full-replace: every option mutation echoes the WHOLE array (with
  // ids) so values pointing at untouched options never break (issue #8 trap).
  function commit(next: SelectOption[]) {
    updateProperty.mutate({
      propertyId: property.id,
      config: { options: next },
    });
  }

  function deleteOption(id: string) {
    commit(removeOption(options, id));
    // Drop the cell's value if it pointed at the option just removed.
    if (selectedId === id) {
      clearValue.mutate({ pageId, propertyId: property.id });
    }
    setEditingOptionId(null);
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
            <OptionPill color={selected.color} label={selected.label} />
          ) : (
            <Text size="sm" c="dimmed">
              {""}
            </Text>
          )}
        </UnstyledButton>
      </Combobox.Target>
      <Combobox.Dropdown>
        {editing ? (
          <OptionEditPanel
            option={editing}
            onRename={(label) => commit(renameOption(options, editing.id, label))}
            onRecolor={(color) =>
              commit(recolorOption(options, editing.id, color))
            }
            onDelete={() => deleteOption(editing.id)}
            onBack={() => setEditingOptionId(null)}
          />
        ) : (
          <>
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
                      <Group gap="xs" justify="space-between" wrap="nowrap">
                        <OptionPill color={o.color} label={o.label} />
                        <ActionIcon
                          component="div"
                          size="xs"
                          variant="subtle"
                          color="gray"
                          aria-label={`Edit ${o.label}`}
                          // Stop the click from bubbling to Combobox.Option
                          // (which would submit/select the option).
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingOptionId(o.id);
                          }}
                        >
                          ⋯
                        </ActionIcon>
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
          </>
        )}
      </Combobox.Dropdown>
    </Combobox>
  );
}

export default SelectCell;
