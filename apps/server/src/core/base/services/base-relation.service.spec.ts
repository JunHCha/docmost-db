import { BadRequestException } from '@nestjs/common';
import {
  BaseRelationService,
  readRelationIds,
  relationOptionsOf,
} from './base-relation.service';

const makeService = (overrides: any = {}) => {
  const basePropertyRepo = {
    findLiveByPageId: jest.fn().mockResolvedValue([]),
    findById: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    ...overrides.basePropertyRepo,
  };
  const baseRowRepo = {
    findById: jest.fn(),
    findLiveByIds: jest.fn().mockResolvedValue([]),
    setCellValue: jest.fn(),
    ...overrides.baseRowRepo,
  };
  const pageRepo = { findById: jest.fn(), ...overrides.pageRepo };
  const service = new BaseRelationService(
    {} as any,
    basePropertyRepo as any,
    baseRowRepo as any,
    pageRepo as any,
  );
  return { service, basePropertyRepo, baseRowRepo, pageRepo };
};

const relationProp = (extra: any = {}) =>
  ({
    id: 'prpSRC',
    pageId: 'base-A',
    name: 'Rel',
    type: 'relation',
    typeOptions: { targetPageId: 'base-B', relatedPropertyId: 'prpREV' },
    workspaceId: 'ws-1',
    deletedAt: null,
    ...extra,
  }) as any;

describe('relation helpers', () => {
  it('readRelationIds keeps only string arrays', () => {
    expect(readRelationIds(['a', 1, 'b'])).toEqual(['a', 'b']);
    expect(readRelationIds('a')).toEqual([]);
    expect(readRelationIds(null)).toEqual([]);
  });

  it('relationOptionsOf requires relation type and targetPageId', () => {
    expect(relationOptionsOf(relationProp())).toEqual({
      targetPageId: 'base-B',
      relatedPropertyId: 'prpREV',
    });
    expect(relationOptionsOf(relationProp({ type: 'text' }))).toBeNull();
    expect(
      relationOptionsOf(relationProp({ typeOptions: {} })),
    ).toBeNull();
  });
});

describe('mirror', () => {
  it('adds source id to added targets and removes from removed targets', async () => {
    const cellsByRow: Record<string, any> = {
      't-added': { prpREV: [] },
      't-removed': { prpREV: ['row-1', 'other'] },
    };
    const { service, baseRowRepo } = makeService({
      baseRowRepo: {
        findById: jest.fn((id: string) =>
          Promise.resolve({ id, deletedAt: null, cells: cellsByRow[id] }),
        ),
      },
    });

    const result = await service.mirror(
      relationProp(),
      'row-1',
      ['t-removed'],
      ['t-added'],
    );

    expect(baseRowRepo.setCellValue).toHaveBeenCalledWith(
      't-added',
      'prpREV',
      ['row-1'],
    );
    expect(baseRowRepo.setCellValue).toHaveBeenCalledWith(
      't-removed',
      'prpREV',
      ['other'],
    );
    expect(result.touchedRowIds.sort()).toEqual(['t-added', 't-removed']);
  });

  it('clears the reverse cell when the last link is removed', async () => {
    const { service, baseRowRepo } = makeService({
      baseRowRepo: {
        findById: jest.fn(() =>
          Promise.resolve({
            id: 't1',
            deletedAt: null,
            cells: { prpREV: ['row-1'] },
          }),
        ),
      },
    });
    await service.mirror(relationProp(), 'row-1', ['t1'], []);
    expect(baseRowRepo.setCellValue).toHaveBeenCalledWith('t1', 'prpREV', null);
  });

  it('is a no-op without relatedPropertyId (legacy unpaired)', async () => {
    const { service, baseRowRepo } = makeService();
    const result = await service.mirror(
      relationProp({ typeOptions: { targetPageId: 'base-B' } }),
      'row-1',
      [],
      ['t1'],
    );
    expect(baseRowRepo.setCellValue).not.toHaveBeenCalled();
    expect(result.touchedRowIds).toEqual([]);
  });

  it('skips already-linked targets (idempotent adds)', async () => {
    const { service, baseRowRepo } = makeService({
      baseRowRepo: {
        findById: jest.fn(() =>
          Promise.resolve({
            id: 't1',
            deletedAt: null,
            cells: { prpREV: ['row-1'] },
          }),
        ),
      },
    });
    const result = await service.mirror(relationProp(), 'row-1', [], ['t1']);
    expect(baseRowRepo.setCellValue).not.toHaveBeenCalled();
    expect(result.touchedRowIds).toEqual([]);
  });
});

describe('assertMembership', () => {
  it('rejects ids not live in the target base', async () => {
    const { service } = makeService({
      baseRowRepo: {
        findLiveByIds: jest.fn().mockResolvedValue([{ id: 'a' }]),
      },
    });
    await expect(
      service.assertMembership(relationProp(), ['a', 'b']),
    ).rejects.toThrow(BadRequestException);
  });

  it('passes when all ids are live rows', async () => {
    const { service } = makeService({
      baseRowRepo: {
        findLiveByIds: jest.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]),
      },
    });
    await expect(
      service.assertMembership(relationProp(), ['a', 'b']),
    ).resolves.toBeUndefined();
  });
});

describe('assertNoDuplicateTarget', () => {
  it('blocks a second live relation to the same target', async () => {
    const { service } = makeService({
      basePropertyRepo: {
        findLiveByPageId: jest
          .fn()
          .mockResolvedValue([relationProp({ id: 'prpOTHER' })]),
      },
    });
    await expect(
      service.assertNoDuplicateTarget('base-A', 'base-B'),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.assertNoDuplicateTarget('base-A', 'base-B', 'prpOTHER'),
    ).resolves.toBeUndefined();
  });
});
