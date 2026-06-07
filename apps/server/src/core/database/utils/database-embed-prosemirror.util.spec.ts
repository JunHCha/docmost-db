import { collectEmbedIdsFromPmJson } from './database-embed-prosemirror.util';

describe('collectEmbedIdsFromPmJson', () => {
  it('returns [] for nullish or non-object input', () => {
    expect(collectEmbedIdsFromPmJson(null)).toEqual([]);
    expect(collectEmbedIdsFromPmJson(undefined)).toEqual([]);
    expect(collectEmbedIdsFromPmJson('doc')).toEqual([]);
  });

  it('collects embedIds from nested databaseView nodes', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'hi' }] },
        {
          type: 'callout',
          content: [
            { type: 'databaseView', attrs: { embedId: 'embed-a' } },
          ],
        },
        { type: 'databaseView', attrs: { embedId: 'embed-b' } },
      ],
    };
    expect(collectEmbedIdsFromPmJson(doc)).toEqual(['embed-a', 'embed-b']);
  });

  it('skips databaseView nodes without a non-empty embedId', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'databaseView', attrs: { embedId: '' } },
        { type: 'databaseView', attrs: {} },
        { type: 'databaseView' },
        { type: 'databaseView', attrs: { embedId: 'embed-a' } },
      ],
    };
    expect(collectEmbedIdsFromPmJson(doc)).toEqual(['embed-a']);
  });

  it('dedupes repeated embedIds preserving first-seen order', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'databaseView', attrs: { embedId: 'embed-b' } },
        { type: 'databaseView', attrs: { embedId: 'embed-a' } },
        { type: 'databaseView', attrs: { embedId: 'embed-b' } },
      ],
    };
    expect(collectEmbedIdsFromPmJson(doc)).toEqual(['embed-b', 'embed-a']);
  });

  it('does not recurse into databaseView children (atom)', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'databaseView',
          attrs: { embedId: 'outer' },
          content: [{ type: 'databaseView', attrs: { embedId: 'inner' } }],
        },
      ],
    };
    expect(collectEmbedIdsFromPmJson(doc)).toEqual(['outer']);
  });

  it('approval: a realistic page doc', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [] },
        { type: 'databaseView', attrs: { embedId: 'v1', databaseId: 'd1' } },
        { type: 'paragraph' },
        { type: 'databaseView', attrs: { embedId: 'v2', databaseId: 'd2' } },
      ],
    };
    expect(collectEmbedIdsFromPmJson(doc)).toEqual(['v1', 'v2']);
  });
});
