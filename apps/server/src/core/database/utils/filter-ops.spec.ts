import { BadRequestException } from '@nestjs/common';
import {
  FILTER_OPS,
  isFilterOp,
  allowedOpsForType,
  assertOpForType,
  assertFilterValueForType,
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

    it('maps computed system types to no ops (not filterable)', () => {
      for (const t of ['created_by', 'created_time', 'last_edited_time'] as const) {
        expect(allowedOpsForType(t)).toEqual([]);
      }
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

  describe('assertFilterValueForType', () => {
    it('ignores value for is_empty/is_not_empty (no value required)', () => {
      expect(assertFilterValueForType('number', 'is_empty', undefined)).toBe(
        undefined,
      );
      expect(
        assertFilterValueForType('text', 'is_not_empty', undefined),
      ).toBe(undefined);
    });

    describe('number', () => {
      it('rejects a non-numeric value with BadRequest (400, not 500)', () => {
        expect(() =>
          assertFilterValueForType('number', 'gte', 'abc'),
        ).toThrow(BadRequestException);
      });

      it('rejects booleans and non-finite values', () => {
        expect(() =>
          assertFilterValueForType('number', 'eq', true as any),
        ).toThrow(BadRequestException);
        expect(() =>
          assertFilterValueForType('number', 'eq', 'NaN'),
        ).toThrow(BadRequestException);
      });

      it('accepts and normalizes numeric input', () => {
        expect(assertFilterValueForType('number', 'gt', 100)).toBe(100);
        expect(assertFilterValueForType('number', 'gt', '100')).toBe(100);
        expect(assertFilterValueForType('number', 'lt', '3.14')).toBe(3.14);
      });
    });

    describe('date', () => {
      it('rejects a malformed date with BadRequest', () => {
        expect(() =>
          assertFilterValueForType('date', 'eq', 'not-a-date'),
        ).toThrow(BadRequestException);
        expect(() =>
          assertFilterValueForType('date', 'eq', 13 as any),
        ).toThrow(BadRequestException);
      });

      it('keeps a bare YYYY-MM-DD verbatim', () => {
        expect(assertFilterValueForType('date', 'gte', '2026-06-05')).toBe(
          '2026-06-05',
        );
      });

      it('normalizes a full ISO timestamp', () => {
        expect(
          assertFilterValueForType('date', 'lt', '2026-06-05T00:00:00.000Z'),
        ).toBe('2026-06-05T00:00:00.000Z');
      });
    });

    describe('checkbox', () => {
      it('accepts booleans and string booleans', () => {
        expect(assertFilterValueForType('checkbox', 'eq', true)).toBe(true);
        expect(assertFilterValueForType('checkbox', 'eq', 'false')).toBe(
          false,
        );
      });

      it('rejects non-boolean input', () => {
        expect(() =>
          assertFilterValueForType('checkbox', 'eq', 'yes'),
        ).toThrow(BadRequestException);
      });
    });

    describe('string-valued types', () => {
      it('accepts a string for text/url/select', () => {
        expect(assertFilterValueForType('text', 'contains', 'hi')).toBe('hi');
        expect(assertFilterValueForType('url', 'eq', 'http://x')).toBe(
          'http://x',
        );
        expect(assertFilterValueForType('select', 'eq', 'opt-1')).toBe(
          'opt-1',
        );
      });

      it('accepts a single id string for multi_select/relation', () => {
        expect(
          assertFilterValueForType('multi_select', 'contains', 'opt-1'),
        ).toBe('opt-1');
        expect(
          assertFilterValueForType('relation', 'not_contains', 'page-1'),
        ).toBe('page-1');
      });

      it('rejects non-string input', () => {
        expect(() =>
          assertFilterValueForType('text', 'eq', 42 as any),
        ).toThrow(BadRequestException);
        expect(() =>
          assertFilterValueForType('multi_select', 'contains', ['a'] as any),
        ).toThrow(BadRequestException);
      });
    });
  });
});
