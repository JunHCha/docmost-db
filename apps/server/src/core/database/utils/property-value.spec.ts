import { BadRequestException } from '@nestjs/common';
import { validateValueForType } from './property-value';

describe('validateValueForType', () => {
  it('rejects a non-object value', () => {
    expect(() => validateValueForType('text', 'plain' as any)).toThrow(
      BadRequestException,
    );
  });

  it('rejects a value whose tag type mismatches the property', () => {
    expect(() =>
      validateValueForType('number', { type: 'text', value: 'x' }),
    ).toThrow(BadRequestException);
  });

  it('accepts a matching text value', () => {
    expect(validateValueForType('text', { type: 'text', value: 'hi' })).toEqual({
      type: 'text',
      value: 'hi',
    });
  });

  it('accepts number or null, rejects strings', () => {
    expect(
      validateValueForType('number', { type: 'number', value: 42 }).value,
    ).toBe(42);
    expect(
      validateValueForType('number', { type: 'number', value: null }).value,
    ).toBeNull();
    expect(() =>
      validateValueForType('number', { type: 'number', value: '42' }),
    ).toThrow(BadRequestException);
  });

  it('validates checkbox booleans', () => {
    expect(
      validateValueForType('checkbox', { type: 'checkbox', value: true }).value,
    ).toBe(true);
    expect(() =>
      validateValueForType('checkbox', { type: 'checkbox', value: 'yes' }),
    ).toThrow(BadRequestException);
  });

  it('checks select option membership against config', () => {
    const config = { options: [{ id: 'o1', label: 'A' }] };
    expect(
      validateValueForType('select', { type: 'select', value: 'o1' }, config)
        .value,
    ).toBe('o1');
    expect(() =>
      validateValueForType('select', { type: 'select', value: 'o2' }, config),
    ).toThrow(BadRequestException);
  });

  it('requires arrays for multi_select and relation', () => {
    expect(() =>
      validateValueForType('multi_select', {
        type: 'multi_select',
        value: 'o1',
      }),
    ).toThrow(BadRequestException);
    expect(
      validateValueForType('relation', {
        type: 'relation',
        value: ['page-1', 'page-2'],
      }).value,
    ).toEqual(['page-1', 'page-2']);
  });
});
