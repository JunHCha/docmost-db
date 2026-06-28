import {
  isTemplatePropertyRef,
  resolveSnapshotConfig,
} from './template-embed-view.util';

describe('isTemplatePropertyRef', () => {
  it('accepts a { templatePropertyRef } object', () => {
    expect(isTemplatePropertyRef({ templatePropertyRef: 'p-1' })).toBe(true);
  });

  it('rejects literal values and malformed shapes', () => {
    expect(isTemplatePropertyRef('p-1')).toBe(false);
    expect(isTemplatePropertyRef(['p-1'])).toBe(false);
    expect(isTemplatePropertyRef(null)).toBe(false);
    expect(isTemplatePropertyRef(undefined)).toBe(false);
    expect(isTemplatePropertyRef({ templatePropertyRef: 123 })).toBe(false);
    expect(isTemplatePropertyRef({})).toBe(false);
  });
});

describe('resolveSnapshotConfig', () => {
  it('passes non-reference filters through unchanged', () => {
    const config = {
      filters: [{ propertyId: 'p-team', op: 'contains', value: 'page-x' }],
    };
    const out = resolveSnapshotConfig(config, new Map());
    expect(out.filters).toEqual([
      { propertyId: 'p-team', op: 'contains', value: 'page-x' },
    ]);
  });

  it('expands a reference filter into one condition per relation id', () => {
    const config = {
      filters: [
        {
          propertyId: 'p-team',
          op: 'contains',
          value: { templatePropertyRef: 'tpl-team' },
        },
      ],
    };
    const rel = new Map([['tpl-team', ['pg-a', 'pg-b']]]);
    const out = resolveSnapshotConfig(config, rel);
    expect(out.filters).toEqual([
      { propertyId: 'p-team', op: 'contains', value: 'pg-a' },
      { propertyId: 'p-team', op: 'contains', value: 'pg-b' },
    ]);
  });

  it('handles a single relation id', () => {
    const config = {
      filters: [
        {
          propertyId: 'p-team',
          op: 'contains',
          value: { templatePropertyRef: 'tpl-team' },
        },
      ],
    };
    const rel = new Map([['tpl-team', ['pg-only']]]);
    const out = resolveSnapshotConfig(config, rel);
    expect(out.filters).toEqual([
      { propertyId: 'p-team', op: 'contains', value: 'pg-only' },
    ]);
  });

  it('drops a reference filter whose relation value is empty', () => {
    const config = {
      filters: [
        {
          propertyId: 'p-team',
          op: 'contains',
          value: { templatePropertyRef: 'tpl-team' },
        },
      ],
    };
    expect(resolveSnapshotConfig(config, new Map([['tpl-team', []]])).filters).toEqual(
      [],
    );
    expect(resolveSnapshotConfig(config, new Map()).filters).toEqual([]);
  });

  it('preserves unrelated filters while resolving references', () => {
    const config = {
      filters: [
        { propertyId: 'p-name', op: 'contains', value: 'x' },
        {
          propertyId: 'p-team',
          op: 'contains',
          value: { templatePropertyRef: 'tpl-team' },
        },
      ],
    };
    const rel = new Map([['tpl-team', ['pg-a']]]);
    const out = resolveSnapshotConfig(config, rel);
    expect(out.filters).toEqual([
      { propertyId: 'p-name', op: 'contains', value: 'x' },
      { propertyId: 'p-team', op: 'contains', value: 'pg-a' },
    ]);
  });

  it('preserves sorts/columns and other config keys', () => {
    const config = {
      filters: [],
      sorts: [{ propertyId: 'p-name', direction: 'asc' }],
      columns: [{ propertyId: 'p-name', visible: true }],
      groupByPropertyId: 'p-status',
    };
    const out = resolveSnapshotConfig(config, new Map());
    expect(out.sorts).toEqual(config.sorts);
    expect(out.columns).toEqual(config.columns);
    expect((out as any).groupByPropertyId).toBe('p-status');
  });

  it('tolerates a config without filters', () => {
    const out = resolveSnapshotConfig({ sorts: [] }, new Map());
    expect(out).toEqual({ sorts: [] });
  });
});
