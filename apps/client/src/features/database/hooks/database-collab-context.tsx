import { createContext, useContext } from "react";
import { DatabaseValueChange } from "./use-database-realtime";

// Lets cell mutations (deep in the table/board views) broadcast their committed
// edit over the DB collab channel without threading the provider through every
// component. The container supplies the real broadcaster; everywhere else
// (e.g. inline embeds with no collab channel) falls back to a no-op so the
// edit still commits locally and simply isn't propagated in real time.
export interface DatabaseCollabContextValue {
  broadcastChange: (change: DatabaseValueChange) => void;
}

const NOOP: DatabaseCollabContextValue = { broadcastChange: () => {} };

export const DatabaseCollabContext =
  createContext<DatabaseCollabContextValue>(NOOP);

export function useDatabaseCollabBroadcast() {
  return useContext(DatabaseCollabContext).broadcastChange;
}
