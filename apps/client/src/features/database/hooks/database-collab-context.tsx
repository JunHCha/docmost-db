import { createContext, useContext } from "react";
import { DatabaseChange } from "./use-database-realtime";
import {
  DatabaseCollabUser,
  DatabaseEditingCell,
} from "./use-database-collab";

// Lets the table/board views reach the DB collab channel without threading the
// provider through every component: cell mutations broadcast their committed
// edit (Phase 2/3), and presence UI (Phase 4) reads online users + who is
// editing which cell and publishes the local editing cell. The container
// supplies the real values; everywhere else (e.g. inline embeds with no collab
// channel) falls back to no-ops/empties so editing still commits locally and
// presence simply isn't shown.
export interface DatabaseCollabContextValue {
  broadcastChange: (change: DatabaseChange) => void;
  onlineUsers: DatabaseCollabUser[];
  editingByCell: Record<string, DatabaseCollabUser[]>;
  setEditingCell: (cell: DatabaseEditingCell | null) => void;
}

const NOOP: DatabaseCollabContextValue = {
  broadcastChange: () => {},
  onlineUsers: [],
  editingByCell: {},
  setEditingCell: () => {},
};

export const DatabaseCollabContext =
  createContext<DatabaseCollabContextValue>(NOOP);

export function useDatabaseCollabBroadcast() {
  return useContext(DatabaseCollabContext).broadcastChange;
}

export function useDatabaseCollabPresence() {
  const { onlineUsers, editingByCell, setEditingCell } =
    useContext(DatabaseCollabContext);
  return { onlineUsers, editingByCell, setEditingCell };
}
