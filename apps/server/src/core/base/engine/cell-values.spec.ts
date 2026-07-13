import { BadRequestException } from '@nestjs/common';
import {
  convertCellValue,
  defaultCells,
  deriveChoicesFromTexts,
  normalizeCellValue,
} from './cell-values';

const property = (type: string, typeOptions: any = {}, extra: any = {}) =>
  ({
    id: 'prp123456789',
    pageId: 'page-1',
    name: 'Test',
    type,
    typeOptions,
    deletedAt: null,
    ...extra,
  }) as any;

describe('normalizeCellValue', () => {
  it('accepts strings for text-ish types and nulls empty strings', () => {
    expect(normalizeCellValue(property('text'), 'hello')).toBe('hello');
    expect(normalizeCellValue(property('text'), '')).toBeNull();
    expect(() => normalizeCellValue(property('text'), 42)).toThrow(
      BadRequestException,
    );
  });

  it('coerces numeric strings and rejects non-finite numbers', () => {
    expect(normalizeCellValue(property('number'), '42.5')).toBe(42.5);
    expect(() => normalizeCellValue(property('number'), 'abc')).toThrow(
      BadRequestException,
    );
  });

  it('stores checkbox true and clears false', () => {
    expect(normalizeCellValue(property('checkbox'), true)).toBe(true);
    expect(normalizeCellValue(property('checkbox'), false)).toBeNull();
  });

  it('validates select choice ids against typeOptions', () => {
    const prop = property('select', {
      choices: [{ id: 'optaaaaaaaaa', name: 'A', color: 'blue' }],
    });
    expect(normalizeCellValue(prop, 'optaaaaaaaaa')).toBe('optaaaaaaaaa');
    expect(() => normalizeCellValue(prop, 'optunknown')).toThrow(
      BadRequestException,
    );
  });

  it('filters multiSelect to known choices and dedupes', () => {
    const prop = property('multiSelect', {
      choices: [
        { id: 'opt1', name: 'A', color: 'blue' },
        { id: 'opt2', name: 'B', color: 'red' },
      ],
    });
    expect(normalizeCellValue(prop, ['opt1', 'opt1', 'optx'])).toEqual([
      'opt1',
    ]);
    expect(normalizeCellValue(prop, [])).toBeNull();
  });

  it('normalizes person scalar to array and dedupes relation ids', () => {
    expect(normalizeCellValue(property('person'), 'u1')).toEqual(['u1']);
    expect(normalizeCellValue(property('relation'), ['r1', 'r1'])).toEqual([
      'r1',
    ]);
  });
});

describe('convertCellValue', () => {
  it('maps select choice id to its name when converting to text', () => {
    const from = property('select', {
      choices: [{ id: 'opt1', name: 'Alpha', color: 'blue' }],
    });
    expect(convertCellValue(from, 'text', {}, 'opt1')).toBe('Alpha');
  });

  it('joins multiSelect names and parses back into numbers when possible', () => {
    const from = property('multiSelect', {
      choices: [
        { id: 'opt1', name: '10', color: 'blue' },
        { id: 'opt2', name: '20', color: 'red' },
      ],
    });
    expect(convertCellValue(from, 'text', {}, ['opt1', 'opt2'])).toBe('10, 20');
    expect(convertCellValue(property('text'), 'number', {}, '42')).toBe(42);
    expect(convertCellValue(property('text'), 'number', {}, 'abc')).toBeNull();
  });

  it('matches text into new select choices by name (case-insensitive)', () => {
    const options = {
      choices: [{ id: 'optN', name: 'Done', color: 'green' }],
    };
    expect(convertCellValue(property('text'), 'select', options, 'done')).toBe(
      'optN',
    );
    expect(
      convertCellValue(property('text'), 'select', options, 'nope'),
    ).toBeNull();
  });

  it('clears values converting into unmappable types', () => {
    expect(convertCellValue(property('text'), 'person', {}, 'hello')).toBeNull();
    expect(convertCellValue(property('number'), 'relation', {}, 5)).toBeNull();
  });
});

describe('defaultCells', () => {
  it('collects valid defaults and skips stale ones', () => {
    const props = [
      property('text', { defaultValue: 'hi' }, { id: 'prpA' }),
      property(
        'select',
        { choices: [{ id: 'opt1', name: 'A', color: 'blue' }], defaultValue: 'optGone' },
        { id: 'prpB' },
      ),
      property('createdAt', { defaultValue: 'x' }, { id: 'prpC' }),
    ];
    expect(defaultCells(props as any)).toEqual({ prpA: 'hi' });
  });
});

describe('deriveChoicesFromTexts', () => {
  it('dedupes case-insensitively and mints opt ids', () => {
    const choices = deriveChoicesFromTexts(['Todo', 'todo', 'Done', '']);
    expect(choices).toHaveLength(2);
    expect(choices[0].id).toMatch(/^opt/);
    expect(choices.map((c) => c.name)).toEqual(['Todo', 'Done']);
  });
});
