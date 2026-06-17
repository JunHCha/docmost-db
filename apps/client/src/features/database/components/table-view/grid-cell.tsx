import { Avatar, Tooltip } from "@mantine/core";
import {
  IDatabaseProperty,
  IDatabasePropertyValue,
} from "@/features/database/types/database.types.ts";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { cellEditingKey } from "../../hooks/use-database-collab";
import { useDatabaseCollabPresence } from "../../hooks/database-collab-context";
import { getCellComponent } from "./cells/registry";

interface GridCellProps {
  property: IDatabaseProperty;
  value: IDatabasePropertyValue | undefined;
  pageId: string;
  databaseId: string;
  // Forwarded to the cell: show a dimmed "Empty" placeholder in empty cells.
  // The row detail panel sets this; the grid leaves it off (issue #93 follow-up).
  showEmptyPlaceholder?: boolean;
}

export function GridCell({
  property,
  value,
  pageId,
  databaseId,
  showEmptyPlaceholder,
}: GridCellProps) {
  const Cell = getCellComponent(property.type);
  const { editingByCell } = useDatabaseCollabPresence();
  // Remote peers editing this exact cell (#55 Phase 4). Self is excluded by the
  // collab hook, so this only ever highlights *other* people's editing.
  const editors = editingByCell[cellEditingKey(pageId, property.id)] ?? [];
  const isRemoteEditing = editors.length > 0;

  return (
    // The data-* attributes let the view-level focus tracker (which fires even
    // when a cell's inline editor unmounts on commit) resolve the focused cell
    // and publish/clear the local editing presence.
    <div
      data-db-cell=""
      data-row-id={pageId}
      data-property-id={property.id}
      style={{
        position: "relative",
        borderRadius: 4,
        boxShadow: isRemoteEditing
          ? "inset 0 0 0 2px var(--mantine-color-blue-5)"
          : undefined,
      }}
    >
      <Cell
        property={property}
        value={value?.value}
        pageId={pageId}
        databaseId={databaseId}
        showEmptyPlaceholder={showEmptyPlaceholder}
      />
      {isRemoteEditing && (
        <Tooltip label={editors.map((u) => u.name).join(", ")} withArrow>
          <Avatar.Group
            spacing="xs"
            style={{ position: "absolute", top: -8, right: -2, zIndex: 1 }}
          >
            {editors.slice(0, 2).map((user) => (
              <CustomAvatar
                key={user.id}
                avatarUrl={user.avatarUrl}
                name={user.name}
                size={16}
                radius="xl"
              />
            ))}
          </Avatar.Group>
        </Tooltip>
      )}
    </div>
  );
}

export default GridCell;
