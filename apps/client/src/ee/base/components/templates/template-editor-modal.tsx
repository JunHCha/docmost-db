import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useTranslation } from "react-i18next";
import {
  BasePropertyType,
  Choice,
  IBase,
  IBaseProperty,
  IBaseTemplate,
  PersonTypeOptions,
  SelectTypeOptions,
} from "@/ee/base/types/base.types";
import {
  useCreateTemplateMutation,
  useUpdateTemplateMutation,
} from "@/ee/base/queries/base-template-query";
import { useWorkspaceMembersQuery } from "@/features/workspace/queries/workspace-query";
import { IUser } from "@/features/user/types/user.types";

// Computed types have no meaningful preset; file/page values are bound to
// row-scoped machinery (uploads, page links) so they are excluded too.
const EXCLUDED_PRESET_TYPES: ReadonlySet<BasePropertyType> = new Set([
  "createdAt",
  "lastEditedAt",
  "lastEditedBy",
  "formula",
  "file",
  "page",
]);

function hasPresetValue(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

function choiceSelectData(
  property: IBaseProperty,
): { value: string; label: string }[] {
  const options = property.typeOptions as SelectTypeOptions | undefined;
  const choices = options?.choices ?? [];
  const order = options?.choiceOrder ?? [];
  const byId = new Map(choices.map((c) => [c.id, c]));
  const orderedIds = new Set(order);
  const ordered: Choice[] = [
    ...(order.map((id) => byId.get(id)).filter(Boolean) as Choice[]),
    ...choices.filter((c) => !orderedIds.has(c.id)),
  ];
  return ordered.map((c) => ({ value: c.id, label: c.name }));
}

// Matches cell-date: cells store full ISO datetimes; the picker works on
// local calendar dates ("YYYY-MM-DD").
function isoToPickerDate(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

type PresetInputProps = {
  property: IBaseProperty;
  value: unknown;
  onChange: (value: unknown) => void;
};

function PersonPresetInput({ property, value, onChange }: PresetInputProps) {
  const { t } = useTranslation();
  const allowMultiple =
    (property.typeOptions as PersonTypeOptions)?.allowMultiple === true;
  const { data: members } = useWorkspaceMembersQuery({ limit: 100 });

  const ids = Array.isArray(value)
    ? (value as string[])
    : typeof value === "string" && value
      ? [value]
      : [];

  const data = useMemo(() => {
    const options = (members?.items ?? []).map((user: IUser) => ({
      value: user.id,
      label: user.name || user.email,
    }));
    // Keep unknown ids selectable so existing presets aren't silently dropped.
    const known = new Set(options.map((o) => o.value));
    return [
      ...options,
      ...ids
        .filter((id) => !known.has(id))
        .map((id) => ({ value: id, label: id.substring(0, 8) })),
    ];
  }, [members, ids]);

  if (allowMultiple) {
    return (
      <MultiSelect
        data={data}
        value={ids}
        onChange={(next) => onChange(next.length > 0 ? next : null)}
        searchable
        clearable
        placeholder={ids.length === 0 ? t("Empty") : undefined}
      />
    );
  }

  return (
    <Select
      data={data}
      value={ids[0] ?? null}
      onChange={(next) => onChange(next)}
      searchable
      clearable
      placeholder={t("Empty")}
    />
  );
}

function PresetField({ property, value, onChange }: PresetInputProps) {
  const { t } = useTranslation();

  switch (property.type) {
    case "text":
    case "url":
    case "email":
      return (
        <TextInput
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.currentTarget.value)}
          placeholder={t("Empty")}
        />
      );
    case "longText":
      return (
        <Textarea
          autosize
          minRows={1}
          maxRows={4}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.currentTarget.value)}
          placeholder={t("Empty")}
        />
      );
    case "number":
      return (
        <NumberInput
          hideControls
          value={typeof value === "number" ? value : ""}
          onChange={(next) => {
            const num = typeof next === "number" ? next : Number(next);
            onChange(next === "" || Number.isNaN(num) ? null : num);
          }}
          placeholder={t("Empty")}
        />
      );
    case "checkbox":
      return (
        <Checkbox
          checked={value === true}
          onChange={(e) => onChange(e.currentTarget.checked ? true : null)}
        />
      );
    case "select":
    case "status":
      return (
        <Select
          data={choiceSelectData(property)}
          value={typeof value === "string" ? value : null}
          onChange={(next) => onChange(next)}
          searchable
          clearable
          placeholder={t("Empty")}
        />
      );
    case "multiSelect":
      return (
        <MultiSelect
          data={choiceSelectData(property)}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={(next) => onChange(next.length > 0 ? next : null)}
          searchable
          clearable
          placeholder={
            Array.isArray(value) && value.length > 0 ? undefined : t("Empty")
          }
        />
      );
    case "date":
      return (
        <DateInput
          value={isoToPickerDate(value)}
          onChange={(next) =>
            onChange(next ? new Date(next).toISOString() : null)
          }
          clearable
          placeholder={t("Empty")}
        />
      );
    case "person":
      return (
        <PersonPresetInput
          property={property}
          value={value}
          onChange={onChange}
        />
      );
    default:
      return (
        <Text size="sm" c="dimmed">
          {t("Not supported")}
        </Text>
      );
  }
}

type TemplateEditorModalProps = {
  opened: boolean;
  onClose: () => void;
  base: IBase;
  pageId: string;
  /** Template to edit; null/undefined opens in create mode. */
  template?: IBaseTemplate | null;
};

export function TemplateEditorModal({
  opened,
  onClose,
  base,
  pageId,
  template,
}: TemplateEditorModalProps) {
  const { t } = useTranslation();
  const isEdit = !!template;

  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [cells, setCells] = useState<Record<string, unknown>>({});

  const createMutation = useCreateTemplateMutation();
  const updateMutation = useUpdateTemplateMutation();
  const saving = createMutation.isPending || updateMutation.isPending;

  // Re-seed the form each time the modal opens (create and edit alike).
  useEffect(() => {
    if (!opened) return;
    setName(template?.name ?? "");
    setIcon(template?.icon ?? "");
    setCells({ ...(template?.cells ?? {}) });
  }, [opened, template]);

  const presetProperties = useMemo(
    () => base.properties.filter((p) => !EXCLUDED_PRESET_TYPES.has(p.type)),
    [base.properties],
  );

  const setCellValue = useCallback((propertyId: string, value: unknown) => {
    setCells((prev) => {
      const next = { ...prev };
      if (hasPresetValue(value)) next[propertyId] = value;
      else delete next[propertyId];
      return next;
    });
  }, []);

  const handleSave = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName || saving) return;

    // Only properties with an actual value belong in the preset.
    const presetCells: Record<string, unknown> = {};
    for (const [propertyId, value] of Object.entries(cells)) {
      if (hasPresetValue(value)) presetCells[propertyId] = value;
    }

    const trimmedIcon = icon.trim();
    if (isEdit && template) {
      updateMutation.mutate(
        {
          templateId: template.id,
          pageId,
          name: trimmedName,
          icon: trimmedIcon ? trimmedIcon : null,
          cells: presetCells,
        },
        { onSuccess: onClose },
      );
    } else {
      createMutation.mutate(
        {
          pageId,
          name: trimmedName,
          ...(trimmedIcon ? { icon: trimmedIcon } : {}),
          cells: presetCells,
        },
        { onSuccess: onClose },
      );
    }
  }, [
    name,
    icon,
    cells,
    saving,
    isEdit,
    template,
    pageId,
    createMutation,
    updateMutation,
    onClose,
  ]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? t("Edit template") : t("New template")}
      size="lg"
      centered
    >
      <Stack gap="md">
        <Group wrap="nowrap" gap="sm" align="flex-end">
          <TextInput
            label={t("Name")}
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder={t("Template name")}
            required
            data-autofocus
            style={{ flex: 1 }}
          />
          <TextInput
            label={t("Icon")}
            value={icon}
            onChange={(e) => setIcon(e.currentTarget.value)}
            placeholder="🙂"
            w={80}
          />
        </Group>

        <div>
          <Text size="sm" fw={500} mb={4}>
            {t("Cell presets")}
          </Text>
          <Text size="xs" c="dimmed" mb="xs">
            {t("New rows created from this template start with these values.")}
          </Text>
          <Stack gap="xs">
            {presetProperties.map((property) => (
              <Group
                key={property.id}
                wrap="nowrap"
                align="flex-start"
                gap="sm"
              >
                <Text
                  size="sm"
                  c="dimmed"
                  w={140}
                  mt={6}
                  truncate
                  style={{ flexShrink: 0 }}
                  title={property.name}
                >
                  {property.name}
                </Text>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <PresetField
                    property={property}
                    value={cells[property.id]}
                    onChange={(value) => setCellValue(property.id, value)}
                  />
                </div>
              </Group>
            ))}
            {presetProperties.length === 0 && (
              <Text size="sm" c="dimmed">
                {t("No properties available")}
              </Text>
            )}
          </Stack>
        </div>

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button
            onClick={handleSave}
            loading={saving}
            disabled={!name.trim()}
          >
            {isEdit ? t("Save") : t("Create")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
