import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Popover, TextInput } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import {
  IBaseProperty,
  IBaseRow,
  RelationTypeOptions,
  RowRef,
} from "@/ee/base/types/base.types";
import { useReferenceStore, useHydrateRows } from "@/ee/base/reference/reference-store";
import { useBaseQuery } from "@/ee/base/queries/base-query";
import { listRows } from "@/ee/base/services/base-service";
import { choiceColor } from "@/ee/base/components/cells/choice-color";
import { BadgeOverflowList } from "@/ee/base/components/cells/badge-overflow";
import { useListKeyboardNav } from "@/ee/base/hooks/use-list-keyboard-nav";
import cellClasses from "@/ee/base/styles/cells.module.css";

type CellRelationProps = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  onCommit: (value: unknown) => void;
  onValueChange: (value: unknown) => void;
  onCancel: () => void;
};

function parseRowIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string");
}

export function CellRelation({
  value,
  property,
  isEditing,
  onValueChange,
  onCancel,
}: CellRelationProps) {
  const { t } = useTranslation();
  const selectedIds = parseRowIds(value);
  const store = useReferenceStore(property.pageId);
  const rowRefs = store.rows ?? {};

  const titleFor = useCallback(
    (id: string) => {
      const ref = rowRefs[id];
      if (!ref) return "…";
      return ref.title || t("Untitled");
    },
    [rowRefs, t],
  );

  if (isEditing) {
    return (
      <RelationPicker
        property={property}
        selectedIds={selectedIds}
        titleFor={titleFor}
        onValueChange={onValueChange}
        onCancel={onCancel}
      />
    );
  }

  if (selectedIds.length === 0) {
    return <span className={cellClasses.emptyValue} />;
  }

  return <RelationBadgeList ids={selectedIds} titleFor={titleFor} />;
}

function RelationBadgeList({
  ids,
  titleFor,
}: {
  ids: string[];
  titleFor: (id: string) => string;
}) {
  const chips = ids.map((id) => (
    <span key={id} className={cellClasses.badge} style={choiceColor("gray")}>
      {titleFor(id)}
    </span>
  ));
  return (
    <BadgeOverflowList
      chips={chips}
      measureKey={ids.map((id) => `${id}:${titleFor(id)}`).join("|")}
      tooltipLabel={ids.map(titleFor).join(", ")}
    />
  );
}

type RelationPickerProps = {
  property: IBaseProperty;
  selectedIds: string[];
  titleFor: (id: string) => string;
  onValueChange: (value: unknown) => void;
  onCancel: () => void;
};

function RelationPicker({
  property,
  selectedIds,
  titleFor,
  onValueChange,
  onCancel,
}: RelationPickerProps) {
  const { t } = useTranslation();
  const typeOptions = property.typeOptions as RelationTypeOptions | undefined;
  const targetPageId = typeOptions?.targetPageId;

  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const hydrateRows = useHydrateRows(property.pageId);

  useEffect(() => {
    requestAnimationFrame(() => searchRef.current?.focus());
  }, []);

  const { data: targetBase } = useBaseQuery(targetPageId);
  const primaryPropertyId = useMemo(
    () => targetBase?.properties.find((p) => p.isPrimary)?.id,
    [targetBase],
  );

  const { data: rowsPage, isLoading } = useQuery({
    queryKey: ["base-relation-rows", targetPageId],
    queryFn: () => listRows(targetPageId!, { limit: 100 }),
    enabled: !!targetPageId,
    staleTime: 15_000,
  });

  const targetRowTitle = useCallback(
    (row: IBaseRow): string => {
      if (!primaryPropertyId) return "";
      const cell = row.cells?.[primaryPropertyId];
      return typeof cell === "string" ? cell : "";
    },
    [primaryPropertyId],
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const candidates = useMemo(() => {
    const rows = rowsPage?.items ?? [];
    const trimmed = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (selectedSet.has(row.id)) return false;
      if (!trimmed) return true;
      return targetRowTitle(row).toLowerCase().includes(trimmed);
    });
  }, [rowsPage, search, selectedSet, targetRowTitle]);

  const handleToggle = useCallback(
    (row: IBaseRow) => {
      const next = selectedSet.has(row.id)
        ? selectedIds.filter((id) => id !== row.id)
        : [...selectedIds, row.id];
      // Hydrate the picked row so the read view resolves without a refetch.
      const ref: RowRef = {
        id: row.id,
        pageId: row.pageId,
        title: targetRowTitle(row) || null,
      };
      hydrateRows([ref]);
      onValueChange(next.length > 0 ? next : null);
    },
    [selectedIds, selectedSet, targetRowTitle, hydrateRows, onValueChange],
  );

  const handleRemove = useCallback(
    (id: string) => {
      const next = selectedIds.filter((sid) => sid !== id);
      onValueChange(next.length > 0 ? next : null);
    },
    [selectedIds, onValueChange],
  );

  const { activeIndex, setActiveIndex, handleNavKey, setOptionRef } =
    useListKeyboardNav(candidates.length, [search]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (handleNavKey(e)) return;
      if (e.key === "Enter") {
        if (activeIndex < 0 || activeIndex >= candidates.length) return;
        e.preventDefault();
        handleToggle(candidates[activeIndex]);
      }
    },
    [onCancel, handleNavKey, activeIndex, candidates, handleToggle],
  );

  return (
    <Popover
      opened
      onChange={(o) => {
        if (!o) onCancel();
      }}
      onClose={onCancel}
      position="bottom-start"
      width={320}
      trapFocus
      closeOnClickOutside
      closeOnEscape
      hideDetached={false}
    >
      <Popover.Target>
        <div className={cellClasses.popoverTarget}>
          {selectedIds.length > 0 ? (
            <RelationBadgeList ids={selectedIds} titleFor={titleFor} />
          ) : (
            <span className={cellClasses.emptyValue} />
          )}
        </div>
      </Popover.Target>
      <Popover.Dropdown p={4}>
        {selectedIds.length > 0 && (
          <div className={cellClasses.personTagArea}>
            {selectedIds.map((id) => (
              <span
                key={id}
                className={cellClasses.badge}
                style={choiceColor("gray")}
              >
                {titleFor(id)}
                <button
                  type="button"
                  className={`${cellClasses.personTagRemove} ${cellClasses.badgeRemoveBtn}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(id);
                  }}
                >
                  <IconX size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
        <TextInput
          ref={searchRef}
          size="xs"
          placeholder={t("Search rows")}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          mb={4}
          data-autofocus
        />
        <div className={cellClasses.selectDropdown}>
          {candidates.length === 0 && (
            <div className={cellClasses.personDropdownHint}>
              {isLoading ? t("Loading…") : t("No results")}
            </div>
          )}
          {candidates.map((row, idx) => {
            const title = targetRowTitle(row);
            return (
              <div
                key={row.id}
                ref={setOptionRef(idx)}
                className={clsx(
                  cellClasses.selectOption,
                  idx === activeIndex && cellClasses.selectOptionKeyboardActive,
                )}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => handleToggle(row)}
              >
                <span className={cellClasses.personOptionName}>
                  {title || t("Untitled")}
                </span>
              </div>
            );
          })}
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
