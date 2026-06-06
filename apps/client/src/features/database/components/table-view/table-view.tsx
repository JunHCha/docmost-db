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
  useUpdateViewMutation,
} from "@/features/database/queries/database-query.ts";
import { IPage } from "@/features/page/types/page.types.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { ColumnHeader } from "./column-header";
import { GridCell } from "./grid-cell";
import { inlineDisplayStyle, inlineInputStyles } from "./cells/inline-text";
import { echoColumns, resolveColumns } from "./view-columns";

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
}

export function TableView({
  databaseId,
  spaceId,
  properties,
  rows,
  activeView,
  spaceSlug,
}: TableViewProps) {
  const { t } = useTranslation();
  const createRow = useCreateRowMutation(databaseId);
  const createProperty = useCreatePropertyMutation(databaseId);
  const updateView = useUpdateViewMutation(databaseId);

  const configColumns = activeView.config.columns;
  const columns = useMemo(
    () => resolveColumns(properties, configColumns),
    [properties, configColumns],
  );
  const ordered = useMemo(() => columns.map((c) => c.property), [columns]);

  // Persist a single column's config change as a full echoed columns array —
  // the view config is replaced wholesale on update (see echoColumns).
  function commitColumn(propertyId: string, patch: { visible?: boolean; width?: number }) {
    updateView.mutate({
      viewId: activeView.id,
      config: {
        ...activeView.config,
        columns: echoColumns(properties, configColumns, { propertyId, ...patch }),
      },
    });
  }

  return (
    // Scroll horizontally when columns overflow the page width instead of
    // squeezing them. max-content lets the table grow to its natural width;
    // minWidth keeps it filling the page when there are only a few columns.
    // The column-header config menu opens in a portal (see column-header), so
    // it is not clipped by this overflow container — no min-height needed.
    <div
      data-testid="table-view"
      style={{ overflowX: "auto", maxWidth: "100%" }}
    >
      <Table
        withTableBorder
        withColumnBorders
        striped
        highlightOnHover
        // Fixed layout keeps every column at its declared width, so switching a
        // cell into edit mode (input/caret) can't reflow the column. width is
        // the sum of declared widths so it still grows past the page (the
        // wrapper scrolls horizontally) rather than being squeezed.
        style={{ minWidth: "100%", width: "max-content", tableLayout: "fixed" }}
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ width: 220 }}>
              <Text size="sm" fw={500}>
                {t("Title")}
              </Text>
            </Table.Th>
            {columns.map(({ property, width }) => (
              <Table.Th key={property.id} style={{ width }}>
                <ColumnHeader
                  property={property}
                  databaseId={databaseId}
                  spaceId={spaceId}
                  orderedProperties={ordered}
                  width={width}
                  onHide={() => commitColumn(property.id, { visible: false })}
                  onResize={(next) => commitColumn(property.id, { width: next })}
                />
              </Table.Th>
            ))}
            <Table.Th style={{ width: 48 }}>
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
          {rows.map(({ row, values }) => (
            <Table.Tr key={row.id}>
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
              <Table.Td />
            </Table.Tr>
          ))}
          <Table.Tr>
            <Table.Td colSpan={columns.length + 2}>
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
