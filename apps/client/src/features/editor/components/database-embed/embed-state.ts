import { IDatabase } from "@/features/database/types/database.types.ts";

// Pure resolver for the inline database embed's render branch (issue #24).
// Extracted from the NodeView so the loading/no-access/not-found/error/ready
// decision can be unit-tested without mounting a full Tiptap NodeView.
export interface EmbedStateInput {
  // null when the node's attrs are broken (missing databaseId).
  databaseId: string | null;
  isLoading: boolean;
  isError: boolean;
  // HTTP status pulled off the axios error (error.response.status), if any.
  status: number | undefined;
  // The info query payload: a database, null (200 with no database), or
  // undefined while unresolved.
  database: IDatabase | null | undefined;
}

export type EmbedState =
  | { kind: "loading" }
  | { kind: "no_access" }
  | { kind: "not_found" }
  | { kind: "error" }
  | { kind: "ready"; database: IDatabase };

export function resolveEmbedState(input: EmbedStateInput): EmbedState {
  const { databaseId, isLoading, isError, status, database } = input;

  // Broken attrs: the node carries no database to resolve at all.
  if (!databaseId) return { kind: "not_found" };

  if (isLoading) return { kind: "loading" };

  if (isError) {
    if (status === 403) return { kind: "no_access" };
    if (status === 404) return { kind: "not_found" };
    return { kind: "error" };
  }

  // The server answers 200 with database: null when the id no longer resolves.
  if (!database) return { kind: "not_found" };

  return { kind: "ready", database };
}
