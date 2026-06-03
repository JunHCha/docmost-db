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
} from "@/features/database/types/database.types.ts";
import {
  useCreatePropertyMutation,
  useCreateRowMutation,
  useUpdateRowTitleMutation,
} from "@/features/database/queries/database-query.ts";
import { IPage } from "@/features/page/types/page.types.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { ColumnHeader } from "./column-header";
import { GridCell } from "./grid-cell";
import { inlineDisplayStyle, inlineInputStyles } from "./cells/inline-text";

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

interface GridViewProps {
  databaseId: string;
  properties: IDatabaseProperty[];
  rows: IDatabaseRow[];
  spaceSlug?: string;
}

export function GridView({
  databaseId,
  properties,
  rows,
  spaceSlug,
}: GridViewProps) {
  const { t } = useTranslation();
  const createRow = useCreateRowMutation(databaseId);
  const createProperty = useCreatePropertyMutation(databaseId);

  const ordered = useMemo(
    () => [...properties].sort((a, b) => a.position.localeCompare(b.position)),
    [properties],
  );

  return (
    // Scroll horizontally when columns overflow the page width instead of
    // squeezing them. max-content lets the table grow to its natural width;
    // minWidth keeps it filling the page when there are only a few columns.
    <div style={{ overflowX: "auto", maxWidth: "100%" }}>
      <Table
        withTableBorder
        withColumnBorders
        striped
        highlightOnHover
        style={{ minWidth: "100%", width: "max-content" }}
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th>
              <Text size="sm" fw={500}>
                {t("Title")}
              </Text>
            </Table.Th>
            {ordered.map((property) => (
              <Table.Th key={property.id}>
                <ColumnHeader
                  property={property}
                  databaseId={databaseId}
                  orderedProperties={ordered}
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
              {ordered.map((property) => (
                <Table.Td key={property.id}>
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
            <Table.Td colSpan={ordered.length + 2}>
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

export default GridView;
