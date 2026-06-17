import { useMemo, useState } from "react";
import {
  Table,
  Button,
  ActionIcon,
  Group,
  Text,
  TextInput,
} from "@mantine/core";
import { IconArrowsDiagonal } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  IDatabaseProperty,
  IDatabaseRow,
  IDatabaseView,
} from "@/features/database/types/database.types.ts";
import {
  useCreatePropertyMutation,
  useCreateRowMutation,
  useUpdateRowTitleMutation,
} from "@/features/database/queries/database-query.ts";
import { IPage } from "@/features/page/types/page.types.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { ColumnHeader } from "./column-header";
import { ColumnResizeHandle } from "./column-resize-handle";
import { GridCell } from "./grid-cell";
import { inlineDisplayStyle, inlineInputStyles } from "./cells/inline-text";
import { resolveColumns } from "./view-columns";
import { useRowSelection } from "./row-selection";
import { GutterHeaderCheckbox, GutterRowCheckbox } from "./grid-row-gutter";
import { SelectionActionBar } from "./selection-action-bar";
import classes from "./table-view.module.css";

const GUTTER_WIDTH = 36;
// Fallback width (px) for the leading Title column when the view has no
// persisted titleWidth yet.
const DEFAULT_TITLE_WIDTH = 220;

interface RowTitleCellProps {
  row: IPage;
  databaseId: string;
  // Slug of the database's space — taken from the current route, since list
  // rows don't carry their space (a row lives in the same space as its DB).
  spaceSlug?: string;
}

// The leading "Title" column shows the row's page title with inline editing.
// Clicking the title text edits it; the separate hover trigger opens the row as
// a full page (#9) — the two actions must never be conflated.
function RowTitleCell({ row, databaseId, spaceSlug }: RowTitleCellProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const update = useUpdateRowTitleMutation(databaseId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.title ?? "");

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== row.title) {
      update.mutate({ pageId: row.id, title: next });
    }
  }

  if (editing) {
    return (
      <TextInput
        autoFocus
        size="sm"
        variant="unstyled"
        styles={inlineInputStyles}
        value={draft}
        aria-label={t("Row title")}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <Group gap={4} wrap="nowrap" className="db-row-title">
      <Text
        size="sm"
        c={row.title ? undefined : "dimmed"}
        style={{ ...inlineDisplayStyle, flex: 1 }}
        onClick={() => {
          setDraft(row.title ?? "");
          setEditing(true);
        }}
      >
        {row.title || t("Untitled")}
      </Text>
      <ActionIcon
        className={classes.openRow}
        variant="subtle"
        size="sm"
        aria-label={t("Open row")}
        onClick={() => navigate(buildPageUrl(spaceSlug, row.slugId, row.title))}
      >
        <IconArrowsDiagonal size={16} />
      </ActionIcon>
    </Group>
  );
}

interface TableViewProps {
  databaseId: string;
  spaceId: string;
  properties: IDatabaseProperty[];
  rows: IDatabaseRow[];
  activeView: IDatabaseView;
  spaceSlug?: string;
  // Deferred-save column edits (#92): these bubble to DatabaseView's draft
  // instead of persisting immediately. Optional so other callers can omit them.
  onHideColumn?: (propertyId: string) => void;
  onResizeColumn?: (propertyId: string, width: number) => void;
  onResizeTitle?: (width: number) => void;
  onReorderColumns?: (orderedPropertyIds: string[]) => void;
}

export function TableView({
  databaseId,
  spaceId,
  properties,
  rows,
  activeView,
  spaceSlug,
  onHideColumn,
  onResizeColumn,
  onResizeTitle,
  onReorderColumns,
}: TableViewProps) {
  const { t } = useTranslation();
  const createRow = useCreateRowMutation(databaseId);
  const createProperty = useCreatePropertyMutation(databaseId);

  const configColumns = activeView.config.columns;
  const columns = useMemo(
    () => resolveColumns(properties, configColumns),
    [properties, configColumns],
  );
  const ordered = useMemo(() => columns.map((c) => c.property), [columns]);

  // The Title column is not a property, so its resizable width lives directly on
  // the view config (titleWidth) rather than in config.columns.
  const titleWidth =
    typeof activeView.config.titleWidth === "number"
      ? activeView.config.titleWidth
      : DEFAULT_TITLE_WIDTH;

  // Multi-select over the visible (already filtered/sorted) rows.
  const visibleRowIds = useMemo(() => rows.map((r) => r.row.id), [rows]);
  const selection = useRowSelection(visibleRowIds);

  function selectRow(id: string, mods: { shift: boolean }) {
    if (mods.shift) selection.selectRange(id);
    else selection.toggle(id);
  }

  // Reorder a column to land immediately after `afterPropertyId` (null => front)
  // in the current display order, then hand the new property-id order up to the
  // draft (#92: column order is view-scoped now, not a global property.position).
  function reorderColumn(
    propertyId: string,
    afterPropertyId: string | undefined,
  ) {
    const ids = ordered.map((p) => p.id).filter((id) => id !== propertyId);
    const at = afterPropertyId ? ids.indexOf(afterPropertyId) + 1 : 0;
    ids.splice(at, 0, propertyId);
    onReorderColumns?.(ids);
  }

  return (
    // Scroll horizontally when columns overflow the page width. The column-header
    // config menu opens in a portal (see column-header), so it is not clipped by
    // this overflow container.
    <div
      data-testid="table-view"
      style={{ overflowX: "auto", maxWidth: "100%" }}
    >
      {selection.selectedIds.size > 0 && (
        <SelectionActionBar
          databaseId={databaseId}
          selectedIds={selection.selectedIds}
          onClear={selection.clear}
        />
      )}
      <Table
        withTableBorder
        withColumnBorders
        striped
        highlightOnHover
        // Fixed layout keeps every declared-width column (gutter, Title, data
        // columns) at its width, so switching a cell into edit mode can't reflow
        // it and the selection gutter stays minimal. width:100% fills the page,
        // but only the trailing "no-data" column has NO width — so it (not the
        // data columns) absorbs the leftover space, and resizing one column never
        // redistributes the others. When columns overflow the page the table
        // grows past 100% and the wrapper scrolls.
        style={{ width: "100%", tableLayout: "fixed" }}
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ width: GUTTER_WIDTH }}>
              <GutterHeaderCheckbox
                checked={selection.isAllSelected}
                indeterminate={selection.isIndeterminate}
                onToggleAll={selection.selectAll}
              />
            </Table.Th>
            <Table.Th
              className={classes.headerCell}
              style={{ width: titleWidth }}
            >
              <div className={classes.headerCellContent}>
                <Text size="sm" fw={500}>
                  {t("Title")}
                </Text>
              </div>
              <ColumnResizeHandle
                width={titleWidth}
                onResize={(next) => onResizeTitle?.(next)}
              />
            </Table.Th>
            {columns.map(({ property, width }) => (
              <Table.Th
                key={property.id}
                className={classes.headerCell}
                style={{ width }}
              >
                <ColumnHeader
                  property={property}
                  databaseId={databaseId}
                  spaceId={spaceId}
                  orderedProperties={ordered}
                  width={width}
                  onHide={() => onHideColumn?.(property.id)}
                  onResize={(next) => onResizeColumn?.(property.id, next)}
                  onReorder={reorderColumn}
                />
              </Table.Th>
            ))}
            {/* Trailing "no-data" column: the only column without a fixed width,
                so it absorbs the page's leftover space (subtle background marks
                it as empty). The Add-column button sits at its left edge, right
                after the last data column. */}
            <Table.Th className={classes.noData}>
              <ActionIcon
                variant="subtle"
                aria-label={t("Add column")}
                onClick={() =>
                  createProperty.mutate({
                    databaseId,
                    name: t("New column"),
                    type: "text",
                  })
                }
              >
                +
              </ActionIcon>
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map(({ row, values }) => {
            const selected = selection.selectedIds.has(row.id);
            return (
              <Table.Tr
                key={row.id}
                data-selected={selected || undefined}
                className={classes.row}
              >
                <Table.Td
                  className={classes.gutter}
                  data-selected={selected || undefined}
                  style={{ width: GUTTER_WIDTH }}
                >
                  <GutterRowCheckbox
                    checked={selected}
                    onSelect={(mods) => selectRow(row.id, mods)}
                  />
                </Table.Td>
                <Table.Td>
                  <RowTitleCell
                    row={row}
                    databaseId={databaseId}
                    spaceSlug={spaceSlug}
                  />
                </Table.Td>
                {columns.map(({ property, width }) => (
                  <Table.Td key={property.id} style={{ width }}>
                    <GridCell
                      property={property}
                      value={values.find((v) => v.propertyId === property.id)}
                      pageId={row.id}
                      databaseId={databaseId}
                    />
                  </Table.Td>
                ))}
                <Table.Td className={classes.noData} />
              </Table.Tr>
            );
          })}
          <Table.Tr>
            <Table.Td colSpan={columns.length + 3}>
              <Button
                variant="subtle"
                size="xs"
                onClick={() => createRow.mutate({ databaseId })}
              >
                {t("+ Row")}
              </Button>
            </Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>
    </div>
  );
}

export default TableView;
