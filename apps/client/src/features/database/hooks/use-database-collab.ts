import { useCallback, useEffect, useRef, useState } from "react";
import {
  HocuspocusProvider,
  HocuspocusProviderWebsocket,
} from "@hocuspocus/provider";
import { useAtomValue } from "jotai";
import { getCollaborationUrl } from "@/lib/config.ts";
import { useCollabToken } from "@/features/auth/queries/auth-query.tsx";
import { userAtom } from "@/features/user/atoms/current-user-atom";

export interface DatabaseCollabUser {
  id: string;
  name: string;
  avatarUrl: string;
}

export interface DatabaseEditingCell {
  rowId: string;
  propertyId: string;
}

// Key for the editingByCell map, shared with cells so they can look up who is
// editing a given (rowId, propertyId).
export function cellEditingKey(rowId: string, propertyId: string): string {
  return `${rowId}:${propertyId}`;
}

interface UseDatabaseCollabResult {
  provider: HocuspocusProvider | null;
  onlineUsers: DatabaseCollabUser[];
  // Remote users currently editing a cell, keyed by cellEditingKey. Self is
  // excluded (you don't highlight your own editing).
  editingByCell: Record<string, DatabaseCollabUser[]>;
  // Publish (or clear, with null) the cell the local user is editing so peers
  // can highlight it.
  setEditingCell: (cell: DatabaseEditingCell | null) => void;
}

/**
 * Connects a DB view to its Hocuspocus collaboration document
 * (`db.<dbPageId>`), publishes the current user into Yjs awareness and
 * exposes the other connected users. Presence/transport only — no document
 * content is synced or persisted here (see Phase 1 of #55).
 */
export function useDatabaseCollab(
  dbPageId: string,
): UseDatabaseCollabResult {
  const { data: collabQuery } = useCollabToken();
  const token = collabQuery?.token;
  const currentUser = useAtomValue(userAtom);
  const [onlineUsers, setOnlineUsers] = useState<DatabaseCollabUser[]>([]);
  const [editingByCell, setEditingByCell] = useState<
    Record<string, DatabaseCollabUser[]>
  >({});

  const providersRef = useRef<{
    provider: HocuspocusProvider;
    socket: HocuspocusProviderWebsocket;
  } | null>(null);
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);

  const setEditingCell = useCallback((cell: DatabaseEditingCell | null) => {
    providersRef.current?.provider.setAwarenessField("editing", cell);
  }, []);

  useEffect(() => {
    if (!dbPageId || !token) return;

    const documentName = `db.${dbPageId}`;
    const socket = new HocuspocusProviderWebsocket({
      url: getCollaborationUrl(),
    });
    const remote = new HocuspocusProvider({
      websocketProvider: socket,
      name: documentName,
      token,
    });
    // When a websocketProvider is supplied, HocuspocusProvider leaves
    // manageSocket=false and does NOT auto-attach, so it never subscribes to
    // the socket's open event — no auth/sync/awareness frames are ever sent.
    // Attach explicitly to establish the connection (mirrors page-editor).
    remote.attach();

    providersRef.current = { provider: remote, socket };
    setProvider(remote);

    const awareness = remote.awareness;

    const syncPresence = () => {
      const localClientId = awareness?.clientID;
      const users: DatabaseCollabUser[] = [];
      const editing: Record<string, DatabaseCollabUser[]> = {};
      awareness?.getStates().forEach((state, clientId) => {
        if (clientId === localClientId) return;
        const user = state?.user as DatabaseCollabUser | undefined;
        if (!user?.id) return;
        users.push(user);
        const cell = state?.editing as DatabaseEditingCell | undefined;
        if (cell?.rowId && cell?.propertyId) {
          const key = cellEditingKey(cell.rowId, cell.propertyId);
          (editing[key] ??= []).push(user);
        }
      });
      setOnlineUsers(users);
      setEditingByCell(editing);
    };

    awareness?.on("change", syncPresence);
    syncPresence();

    return () => {
      awareness?.off("change", syncPresence);
      remote.destroy();
      socket.destroy();
      providersRef.current = null;
      setProvider(null);
      setOnlineUsers([]);
      setEditingByCell({});
    };
  }, [dbPageId, token]);

  useEffect(() => {
    if (!provider || !currentUser) return;
    provider.setAwarenessField("user", {
      id: currentUser.id,
      name: currentUser.name,
      avatarUrl: currentUser.avatarUrl,
    });
  }, [provider, currentUser?.id, currentUser?.name, currentUser?.avatarUrl]);

  return { provider, onlineUsers, editingByCell, setEditingCell };
}
