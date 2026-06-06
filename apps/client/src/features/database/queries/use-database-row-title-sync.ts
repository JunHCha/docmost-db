import { useEffect } from "react";
import { useAtom } from "jotai";
import { useQueryClient } from "@tanstack/react-query";
import { socketAtom } from "@/features/websocket/atoms/socket-atom.ts";
import { WebSocketEvent } from "@/features/websocket/types";
import localEmitter from "@/lib/local-emitter.ts";
import { patchRowTitleEverywhere } from "@/features/database/queries/database-cache.ts";

/**
 * Subscribes to page-title update events from both the local emitter and the
 * WebSocket, and patches every database-rows cache slot where the page appears.
 *
 * Mirrors the pattern used in use-tree-socket.ts so that a title change made
 * in the full-page TitleEditor (which only emits a "message" event + WebSocket
 * updateOne, but never patches the database-rows cache directly) is reflected
 * in the grid Name column immediately — without a page refresh.
 *
 * Works for all sources (same-client full-page editor, other clients over WS)
 * and does not require knowing the databaseId.
 */
export function useDatabaseRowTitleSync() {
  const [socket] = useAtom(socketAtom);
  const queryClient = useQueryClient();

  // ── localEmitter branch ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (event: any) => {
      if (
        event?.operation !== "updateOne" ||
        event?.entity?.[0] !== "pages" ||
        event?.payload?.title === undefined
      ) {
        return;
      }
      patchRowTitleEverywhere(queryClient, event.id, event.payload.title);
    };

    localEmitter.on("message", handler);
    return () => {
      localEmitter.off("message", handler);
    };
  }, [queryClient]);

  // ── WebSocket branch ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handler = (event: WebSocketEvent) => {
      if (
        event.operation !== "updateOne" ||
        event.entity[0] !== "pages" ||
        (event as any).payload?.title === undefined
      ) {
        return;
      }
      patchRowTitleEverywhere(
        queryClient,
        (event as any).id,
        (event as any).payload.title,
      );
    };

    socket.on("message", handler);
    return () => {
      socket.off("message", handler);
    };
  }, [socket, queryClient]);
}
