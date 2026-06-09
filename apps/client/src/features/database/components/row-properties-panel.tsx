import { useMemo } from "react";
import { Group, Stack, Text } from "@mantine/core";
import { IPage } from "@/features/page/types/page.types.ts";
import {
  useDatabaseInfoQuery,
  useDatabasePropertiesQuery,
  useDatabaseRowsQuery,
  useDefaultViewId,
} from "@/features/database/queries/database-query.ts";
import { GridCell } from "./table-view/grid-cell";
import classes from "./row-properties-panel.module.css";

interface RowPropertiesPanelProps {
  page: IPage;
}

// Shown above a row page's body. A page is a database row when its parent page
// is itself a database, so we look the parent up by id — an empty result means
// this is a plain document and the panel renders nothing (regression guard).
export function RowPropertiesPanel({ page }: RowPropertiesPanelProps) {
  const infoQuery = useDatabaseInfoQuery(page.parentPageId ?? "");
  const databaseId = infoQuery.data?.database?.id ?? "";
  const propertiesQuery = useDatabasePropertiesQuery(databaseId);
  const viewId = useDefaultViewId(databaseId);
  const rowsQuery = useDatabaseRowsQuery(databaseId, viewId);

  // The row's values share the grid's ["database-rows", ...] cache, so editing
  // here and viewing in the grid stay in step. Find this page in that list.
  const values = useMemo(
    () => rowsQuery.data?.find((r) => r.row.id === page.id)?.values ?? [],
    [rowsQuery.data, page.id],
  );

  const ordered = useMemo(
    () =>
      [...(propertiesQuery.data ?? [])].sort((a, b) =>
        a.position.localeCompare(b.position),
      ),
    [propertiesQuery.data],
  );

  if (!databaseId || ordered.length === 0) {
    return null;
  }

  // Notion-style property list under the page title: narrow dimmed labels on
  // the left, editable cell values filling the rest. The editor Container has
  // no horizontal padding (the title/body get their inset from ProseMirror's
  // own gutter), so the panel reproduces that 3rem gutter via `classes.panel`
  // and pins maxWidth to stay inside the page body width (#72).
  return (
    <Stack gap={2} mb="md" className={classes.panel} style={{ maxWidth: "100%" }}>
      {ordered.map((property) => (
        <Group key={property.id} wrap="nowrap" align="center" gap="md">
          <Text size="sm" c="dimmed" w={140} style={{ flexShrink: 0 }}>
            {property.name}
          </Text>
          <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
            <GridCell
              property={property}
              value={values.find((v) => v.propertyId === property.id)}
              pageId={page.id}
              databaseId={databaseId}
            />
          </div>
        </Group>
      ))}
    </Stack>
  );
}

export default RowPropertiesPanel;
