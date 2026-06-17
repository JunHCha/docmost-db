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
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import {
  appendOption,
  findOptionByLabel,
  getOptions,
  recolorOption,
  removeOption,
  renameOption,
  type SelectOption,
} from "@/features/database/components/property/option-config.ts";
import { OptionPill } from "@/features/database/components/property/option-pill.tsx";
import { OptionEditPanel } from "@/features/database/components/property/option-edit-panel.tsx";
import { CellProps } from "./cell-props";
import { INLINE_EMPTY_PLACEHOLDER } from "./inline-text";

export function SelectCell({
  property,
  value,
  pageId,
  databaseId,
  showEmptyPlaceholder,
}: CellProps) {
  const { t } = useTranslation();
  const setValue = useSetValueMutation(databaseId);
  const clearValue = useClearValueMutation(databaseId);
  const updateProperty = useUpdatePropertyMutation(databaseId);
  const [opened, setOpened] = useState(false);
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const combobox = useCombobox({
    opened,
    onDropdownClose: () => {
      setOpened(false);
      // Reset to the pill list so reopening never reveals the prior edit view.
      setEditingOptionId(null);
    },
    onDropdownOpen: () => setOpened(true),
  });
  const [search, setSearch] = useState("");

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
    // Never create a duplicate-labeled option: select the existing one instead.
    const existing = findOptionByLabel(options, label);
    if (existing) {
      select(existing.id);
      return;
    }
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

  function renameOptionGuarded(id: string, label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;
    // Keep option labels unique within the property.
    if (findOptionByLabel(options, trimmed, id)) {
      notifications.show({
        message: t("An option with this name already exists"),
        color: "red",
      });
      return;
    }
    commit(renameOption(options, id, trimmed));
  }

  function deleteOption(id: string) {
    // Pure config change: a removed option's id renders as graceful blank
    // (unknown ids are ignored), so the cell value never needs clearing.
    commit(removeOption(options, id));
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
      // Inline in the grid, portal in the row panel (whose overflow:hidden value
      // wrapper would otherwise clip the dropdown to the row, #93 follow-up).
      withinPortal={!!showEmptyPlaceholder}
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
            <Text
              size="sm"
              c="dimmed"
              style={showEmptyPlaceholder ? { fontStyle: "italic" } : undefined}
            >
              {showEmptyPlaceholder ? t(INLINE_EMPTY_PLACEHOLDER) : ""}
            </Text>
          )}
        </UnstyledButton>
      </Combobox.Target>
      <Combobox.Dropdown>
        {editing ? (
          <OptionEditPanel
            option={editing}
            onRename={(label) => renameOptionGuarded(editing.id, label)}
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
