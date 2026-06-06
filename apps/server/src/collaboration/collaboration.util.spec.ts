import { htmlToJson, jsonToHtml, jsonToNode } from './collaboration.util';

const findFirstChild = (json: any, type: string): any | undefined => {
  if (!json || typeof json !== 'object') return undefined;
  if (json.type === type) return json;
  if (Array.isArray(json.content)) {
    for (const child of json.content) {
      const found = findFirstChild(child, type);
      if (found) return found;
    }
  }
  return undefined;
};

const buildDoc = (databaseId: string, viewId: string) => ({
  type: 'doc',
  content: [
    {
      type: 'databaseView',
      attrs: { databaseId, viewId },
    },
  ],
});

describe('databaseView node round-trip', () => {
  it('preserves the databaseView node through JSON → HTML', () => {
    const doc = buildDoc('db-123', 'view-456');
    const html = jsonToHtml(doc);
    expect(html).toContain('data-type="databaseView"');
    expect(html).toContain('data-database-id="db-123"');
    expect(html).toContain('data-view-id="view-456"');
  });

  it('preserves the databaseView node and attrs through HTML → JSON', () => {
    const doc = buildDoc('db-123', 'view-456');
    const html = jsonToHtml(doc);
    const json = htmlToJson(html);
    const node = findFirstChild(json, 'databaseView');
    expect(node).toBeDefined();
    expect(node.attrs.databaseId).toBe('db-123');
    expect(node.attrs.viewId).toBe('view-456');
  });

  it('does not strip the databaseView node in jsonToNode', () => {
    const doc = buildDoc('db-123', 'view-456');
    const node = jsonToNode(doc);
    const child = node.firstChild;
    expect(child).not.toBeNull();
    expect(child!.type.name).toBe('databaseView');
    expect(child!.attrs.databaseId).toBe('db-123');
    expect(child!.attrs.viewId).toBe('view-456');
  });
});
