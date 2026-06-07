const DATABASE_VIEW_TYPE = 'databaseView';

/**
 * Walks a ProseMirror JSON document and returns the unique set of
 * `embedId` attrs found on `databaseView` nodes. The node is an atom so we do
 * not recurse into its children. Nodes without a non-empty string embedId are
 * skipped. Order preserved by first-seen.
 */
export function collectEmbedIdsFromPmJson(doc: unknown): string[] {
  if (!doc || typeof doc !== 'object') return [];

  const seen = new Set<string>();
  const out: string[] = [];

  const visit = (node: any): void => {
    if (!node || typeof node !== 'object') return;

    if (node.type === DATABASE_VIEW_TYPE) {
      const embedId = node.attrs?.embedId;
      if (typeof embedId === 'string' && embedId.length > 0) {
        if (!seen.has(embedId)) {
          seen.add(embedId);
          out.push(embedId);
        }
      }
      return; // atom node - no children
    }

    if (Array.isArray(node.content)) {
      for (const child of node.content) visit(child);
    }
  };

  visit(doc);
  return out;
}
