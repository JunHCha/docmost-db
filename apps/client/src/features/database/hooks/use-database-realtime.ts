import { useCallback, useEffect, useRef } from "react";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { useQueryClient } from "@tanstack/react-query";
import { IDatabasePropertyValue } from "@/features/database/types/database.types.ts";
import {
  patchRowValueIfNewer,
  removeRowValue,
} from "@/features/database/queries/database-cache.ts";

// A cell-level edit to propagate to other clients viewing the same database.
// Postgres stays the source of truth (#55): this is only a hint telling peers
// what changed so they can patch their React Query cache without a refetch.
export type DatabaseValueChange =
  | { kind: "set"; value: IDatabasePropertyValue }
  | { kind: "clear"; pageId: string; propertyId: string };

interface SignalEnvelope {
  // The originating client, so peers can ignore their own echo.
  origin: number;
  // Monotonic per-origin counter, so peers apply each broadcast once even
  // though awareness "change" also fires for unrelated presence updates.
  rev: number;
  change: DatabaseValueChange;
}

export interface UseDatabaseRealtimeResult {
  broadcastChange: (change: DatabaseValueChange) => void;
}

// Awareness state field carrying the latest local change signal.
const AWARENESS_FIELD = "dbChange";

/**
 * Phase 2 of #55 — real-time cell value propagation over the DB collab channel.
 *
 * Publishes the local client's latest committed cell edit into Yjs awareness
 * and applies peers' edit signals to the React Query row cache. Self echoes are
 * ignored (origin clientID) and each peer broadcast is applied once (rev),
 * while concurrent edits to the same cell converge last-write-wins by the
 * server-assigned updatedAt (see patchRowValueIfNewer).
 *
 * No-op until a connected `provider` is supplied, so embeds without a collab
 * channel simply skip propagation.
 */
export function useDatabaseRealtime(
  provider: HocuspocusProvider | null,
  databaseId: string,
): UseDatabaseRealtimeResult {
  const queryClient = useQueryClient();
  const providerRef = useRef<HocuspocusProvider | null>(provider);
  providerRef.current = provider;
  const revRef = useRef(0);

  const broadcastChange = useCallback((change: DatabaseValueChange) => {
    const p = providerRef.current;
    if (!p) return;
    revRef.current += 1;
    const envelope: SignalEnvelope = {
      origin: p.document.clientID,
      rev: revRef.current,
      change,
    };
    p.setAwarenessField(AWARENESS_FIELD, envelope);
  }, []);

  useEffect(() => {
    if (!provider || !databaseId) return;
    const awareness = provider.awareness;
    if (!awareness) return;
    const localClientId = provider.document.clientID;
    const lastSeen = new Map<number, number>();

    const applyRemoteSignals = () => {
      awareness.getStates().forEach((state, clientId) => {
        if (clientId === localClientId) return;
        const envelope = state?.[AWARENESS_FIELD] as SignalEnvelope | undefined;
        if (!envelope || typeof envelope.rev !== "number") return;
        if (envelope.rev <= (lastSeen.get(clientId) ?? 0)) return;
        lastSeen.set(clientId, envelope.rev);

        const change = envelope.change;
        if (change.kind === "set") {
          patchRowValueIfNewer(queryClient, databaseId, change.value);
        } else if (change.kind === "clear") {
          removeRowValue(
            queryClient,
            databaseId,
            change.pageId,
            change.propertyId,
          );
        }
      });
    };

    awareness.on("change", applyRemoteSignals);
    applyRemoteSignals();
    return () => {
      awareness.off("change", applyRemoteSignals);
    };
  }, [provider, databaseId, queryClient]);

  return { broadcastChange };
}
