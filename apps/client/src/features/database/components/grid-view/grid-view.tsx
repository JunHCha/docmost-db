import { useMemo, useState } from "react";
import { Table, Button, ActionIcon, Text, TextInput } from "@mantine/core";
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
import { ColumnHeader } from "./column-header";
import { GridCell } from "./grid-cell";

interface RowTitleCellProps {
  row: IPage;
  databaseId: string;
}

// The leading "Name" column shows the row's page title with inline editing.
// Opening the row as a full page (#9) is intentionally out of scope here.
function RowTitleCell({ row, databaseId }: RowTitleCellProps) {
  const { t } = useTranslation();
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
        size="xs"
        variant="unstyled"
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
    <Text
      size="sm"
      c={row.title ? undefined : "dimmed"}
      onClick={() => {
        setDraft(row.title ?? "");
        setEditing(true);
      }}
    >
      {row.title || t("Untitled")}
    </Text>
  );
}

interface GridViewProps {
  databaseId: string;
  properties: IDatabaseProperty[];
  rows: IDatabaseRow[];
}

export function GridView({ databaseId, properties, rows }: GridViewProps) {
  const { t } = useTranslation();
  const createRow = useCreateRowMutation(databaseId);
  const createProperty = useCreatePropertyMutation(databaseId);

  const ordered = useMemo(
    () => [...properties].sort((a, b) => a.position.localeCompare(b.position)),
    [properties],
  );

  return (
    <Table withTableBorder withColumnBorders striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>
            <Text size="sm" fw={500}>
              {t("Name")}
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
              <RowTitleCell row={row} databaseId={databaseId} />
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
  );
}

export default GridView;
