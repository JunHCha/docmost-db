import { BadRequestException } from '@nestjs/common';
import {
  FILTER_OPS,
  isFilterOp,
  allowedOpsForType,
  assertOpForType,
} from './filter-ops';

describe('filter-ops', () => {
  describe('isFilterOp', () => {
    it('accepts all known ops', () => {
      for (const op of FILTER_OPS) {
        expect(isFilterOp(op)).toBe(true);
      }
    });

    it('rejects unknown ops', () => {
      expect(isFilterOp('like')).toBe(false);
      expect(isFilterOp('')).toBe(false);
    });
  });

  describe('allowedOpsForType', () => {
    it('maps text/url to is/contains/empty ops', () => {
      const ops = allowedOpsForType('text');
      expect(ops).toEqual(
        expect.arrayContaining([
          'eq',
          'neq',
          'contains',
          'not_contains',
          'is_empty',
          'is_not_empty',
        ]),
      );
      expect(ops).not.toContain('gt');
      expect(allowedOpsForType('url')).toEqual(ops);
    });

    it('maps number to comparison ops', () => {
      const ops = allowedOpsForType('number');
      expect(ops).toEqual(
        expect.arrayContaining(['eq', 'neq', 'gt', 'lt', 'gte', 'lte']),
      );
      expect(ops).not.toContain('contains');
    });

    it('maps date to ordering ops', () => {
      const ops = allowedOpsForType('date');
      expect(ops).toEqual(
        expect.arrayContaining(['eq', 'lt', 'gt', 'lte', 'gte']),
      );
      expect(ops).not.toContain('contains');
    });

    it('maps select to eq/neq/empty only', () => {
      expect(allowedOpsForType('select')).toEqual(
        expect.arrayContaining(['eq', 'neq', 'is_empty', 'is_not_empty']),
      );
      expect(allowedOpsForType('select')).not.toContain('contains');
    });

    it('maps multi_select/relation to contains/not_contains/empty', () => {
      for (const t of ['multi_select', 'relation'] as const) {
        const ops = allowedOpsForType(t);
        expect(ops).toEqual(
          expect.arrayContaining([
            'contains',
            'not_contains',
            'is_empty',
            'is_not_empty',
          ]),
        );
        expect(ops).not.toContain('eq');
      }
    });

    it('maps checkbox to eq only', () => {
      expect(allowedOpsForType('checkbox')).toEqual(['eq']);
    });
  });

  describe('assertOpForType', () => {
    it('passes for an allowed op', () => {
      expect(() => assertOpForType('number', 'gte')).not.toThrow();
    });

    it('throws BadRequest for a disallowed op', () => {
      expect(() => assertOpForType('select', 'contains')).toThrow(
        BadRequestException,
      );
      expect(() => assertOpForType('checkbox', 'gt')).toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequest for an unknown op', () => {
      expect(() => assertOpForType('text', 'like' as any)).toThrow(
        BadRequestException,
      );
    });
  });
});
