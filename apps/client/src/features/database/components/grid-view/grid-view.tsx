import { useMemo } from "react";
import { Table, Button, ActionIcon } from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  IDatabaseProperty,
  IDatabaseRow,
} from "@/features/database/types/database.types.ts";
import {
  useCreatePropertyMutation,
  useCreateRowMutation,
} from "@/features/database/queries/database-query.ts";
import { ColumnHeader } from "./column-header";
import { GridCell } from "./grid-cell";

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
          <Table.Td colSpan={ordered.length + 1}>
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
