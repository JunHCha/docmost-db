import { BadRequestException } from '@nestjs/common';
import { PropertyType, SelectOption } from './property-config';

export interface TaggedValue {
  type: PropertyType;
  // jsonb-compatible; the concrete shape is validated per type below.
  value: any;
}

function bad(type: string, expected: string): BadRequestException {
  return new BadRequestException(
    `'${type}' value must be ${expected}`,
  );
}

function assertOptionId(
  id: string,
  config?: { options?: SelectOption[] },
): void {
  const options = config?.options;
  if (Array.isArray(options) && !options.some((o) => o.id === id)) {
    throw new BadRequestException(`Unknown select option id: ${id}`);
  }
}

/**
 * Validate a tagged property value against its property type and (optionally)
 * config. Returns the normalized { type, value } tag. See conventions.md §1.
 */
export function validateValueForType(
  type: PropertyType,
  value: unknown,
  config?: { options?: SelectOption[] },
): TaggedValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('value must be a { type, value } object');
  }
  const tag = value as { type?: unknown; value?: unknown };
  if (tag.type !== type) {
    throw new BadRequestException(
      `value.type '${String(tag.type)}' does not match property type '${type}'`,
    );
  }

  const v = tag.value;
  switch (type) {
    case 'text':
    case 'url':
    case 'date':
      if (typeof v !== 'string') throw bad(type, 'a string');
      break;
    case 'number':
      if (v !== null && typeof v !== 'number') throw bad(type, 'a number or null');
      break;
    case 'checkbox':
      if (typeof v !== 'boolean') throw bad(type, 'a boolean');
      break;
    case 'select':
      if (typeof v !== 'string') throw bad(type, 'an option id');
      assertOptionId(v, config);
      break;
    case 'multi_select':
      if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) {
        throw bad(type, 'an array of option ids');
      }
      v.forEach((x) => assertOptionId(x, config));
      break;
    case 'relation':
      if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) {
        throw bad(type, 'an array of page ids');
      }
      break;
    case 'person':
      // A person value holds workspace user ids (multi-person, like relation).
      // Membership in the workspace is not checked here — that would need DB
      // access; the picker only offers current members.
      if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) {
        throw bad(type, 'an array of user ids');
      }
      break;
    case 'created_by':
    case 'created_time':
    case 'last_edited_time':
      // Computed system columns are derived from page metadata and can never be
      // written directly. See conventions.md / issue #128.
      throw new BadRequestException(
        `'${type}' is a read-only computed property`,
      );
  }

  return { type, value: v };
}
