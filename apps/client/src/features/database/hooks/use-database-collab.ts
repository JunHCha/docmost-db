import { useEffect, useRef, useState } from "react";
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

interface UseDatabaseCollabResult {
  provider: HocuspocusProvider | null;
  onlineUsers: DatabaseCollabUser[];
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

  const providersRef = useRef<{
    provider: HocuspocusProvider;
    socket: HocuspocusProviderWebsocket;
  } | null>(null);
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);

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

    const syncOnlineUsers = () => {
      const localClientId = awareness?.clientID;
      const users: DatabaseCollabUser[] = [];
      awareness?.getStates().forEach((state, clientId) => {
        if (clientId === localClientId) return;
        const user = state?.user as DatabaseCollabUser | undefined;
        if (user?.id) users.push(user);
      });
      setOnlineUsers(users);
    };

    awareness?.on("change", syncOnlineUsers);
    syncOnlineUsers();

    return () => {
      awareness?.off("change", syncOnlineUsers);
      remote.destroy();
      socket.destroy();
      providersRef.current = null;
      setProvider(null);
      setOnlineUsers([]);
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

  return { provider, onlineUsers };
}
