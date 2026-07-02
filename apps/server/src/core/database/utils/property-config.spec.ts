import { BadRequestException } from '@nestjs/common';
import {
  assertPropertyType,
  isPropertyType,
  normalizePropertyConfig,
} from './property-config';

describe('property-config', () => {
  describe('type guards', () => {
    it('accepts the 9 core types', () => {
      for (const t of [
        'text',
        'number',
        'date',
        'select',
        'multi_select',
        'checkbox',
        'url',
        'relation',
        'person',
      ]) {
        expect(isPropertyType(t)).toBe(true);
      }
    });

    it('rejects unknown types', () => {
      expect(isPropertyType('formula')).toBe(false);
      expect(() => assertPropertyType('formula')).toThrow(BadRequestException);
    });
  });

  describe('normalizePropertyConfig', () => {
    it('drops config for plain types', () => {
      expect(normalizePropertyConfig('text', { junk: 1 })).toEqual({});
      expect(normalizePropertyConfig('checkbox', undefined)).toEqual({});
      expect(normalizePropertyConfig('person', { junk: 1 })).toEqual({});
    });

    it('requires an options array for select', () => {
      expect(() => normalizePropertyConfig('select', {})).toThrow(
        BadRequestException,
      );
    });

    it('keeps existing option ids and generates missing ones', () => {
      const result = normalizePropertyConfig('multi_select', {
        options: [
          { id: 'opt-1', label: 'A', color: 'blue' },
          { label: 'B' },
        ],
      }) as any;
      expect(result.options[0]).toEqual({ id: 'opt-1', label: 'A', color: 'blue' });
      expect(result.options[1].id).toEqual(expect.any(String));
      expect(result.options[1].label).toBe('B');
    });

    it('rejects options without a label', () => {
      expect(() =>
        normalizePropertyConfig('select', { options: [{ color: 'red' }] }),
      ).toThrow(BadRequestException);
    });

    it('requires targetDatabaseId for relation', () => {
      expect(() => normalizePropertyConfig('relation', {})).toThrow(
        BadRequestException,
      );
      expect(
        normalizePropertyConfig('relation', { targetDatabaseId: 'db-2' }),
      ).toEqual({ targetDatabaseId: 'db-2' });
    });

    it('preserves relatedPropertyId for relation (bidirectional pairing)', () => {
      expect(
        normalizePropertyConfig('relation', {
          targetDatabaseId: 'db-2',
          relatedPropertyId: 'p-rev',
        }),
      ).toEqual({ targetDatabaseId: 'db-2', relatedPropertyId: 'p-rev' });
    });

    it('drops a non-string relatedPropertyId', () => {
      expect(
        normalizePropertyConfig('relation', {
          targetDatabaseId: 'db-2',
          relatedPropertyId: 123,
        }),
      ).toEqual({ targetDatabaseId: 'db-2' });
    });
  });
});
