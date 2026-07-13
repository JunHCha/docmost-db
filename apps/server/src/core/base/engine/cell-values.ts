import { BadRequestException } from '@nestjs/common';
import { BaseProperty } from '@docmost/db/types/entity.types';
import { Choice, SelectTypeOptions } from '../base.types';
import { generateBaseChoiceId } from '../../../common/helpers/nanoid.utils';

// Property types the client may never write cells for.
const READONLY_TYPES = new Set([
  'createdAt',
  'lastEditedAt',
  'lastEditedBy',
  'formula',
]);

export function isReadonlyType(type: string): boolean {
  return READONLY_TYPES.has(type);
}

function asChoices(property: BaseProperty): Choice[] {
  return ((property.typeOptions as SelectTypeOptions)?.choices ?? []) as Choice[];
}

// Validates and normalizes one cell write. null clears the cell.
export function normalizeCellValue(
  property: BaseProperty,
  value: unknown,
): unknown {
  if (value === null || value === undefined) return null;
  const fail = (msg: string) => {
    throw new BadRequestException(
      `invalid value for ${property.type} property "${property.name}": ${msg}`,
    );
  };

  switch (property.type) {
    case 'text':
    case 'longText':
    case 'url':
    case 'email':
    case 'date': {
      if (typeof value !== 'string') fail('expected a string');
      return value === '' ? null : value;
    }
    case 'number': {
      const num = typeof value === 'string' ? Number(value) : value;
      if (typeof num !== 'number' || !Number.isFinite(num)) {
        fail('expected a number');
      }
      return num;
    }
    case 'checkbox': {
      if (typeof value !== 'boolean') fail('expected a boolean');
      return value === false ? null : value;
    }
    case 'select':
    case 'status': {
      if (typeof value !== 'string') fail('expected a choice id');
      const ids = new Set(asChoices(property).map((c) => c.id));
      if (!ids.has(value as string)) fail('unknown choice');
      return value;
    }
    case 'multiSelect': {
      if (!Array.isArray(value)) fail('expected an array of choice ids');
      const ids = new Set(asChoices(property).map((c) => c.id));
      const out = (value as unknown[]).filter(
        (v): v is string => typeof v === 'string' && ids.has(v),
      );
      return out.length > 0 ? Array.from(new Set(out)) : null;
    }
    case 'person':
    case 'page': {
      const arr = Array.isArray(value) ? value : [value];
      const out = arr.filter((v): v is string => typeof v === 'string');
      if (out.length !== arr.length) fail('expected id strings');
      return out.length > 0 ? Array.from(new Set(out)) : null;
    }
    case 'relation': {
      if (!Array.isArray(value)) fail('expected an array of row ids');
      const out = (value as unknown[]).filter(
        (v): v is string => typeof v === 'string',
      );
      return out.length > 0 ? Array.from(new Set(out)) : null;
    }
    case 'file':
      // Attachment metadata objects; stored verbatim.
      return value;
    default:
      fail('unknown property type');
  }
}

// Default cell values for newly created rows, from typeOptions.defaultValue.
export function defaultCells(
  properties: BaseProperty[],
): Record<string, unknown> {
  const cells: Record<string, unknown> = {};
  for (const property of properties) {
    if (isReadonlyType(property.type)) continue;
    const raw = (property.typeOptions as any)?.defaultValue;
    if (raw === undefined || raw === null || raw === '') continue;
    try {
      const normalized = normalizeCellValue(property, raw);
      if (normalized !== null) cells[property.id] = normalized;
    } catch {
      // Stale defaults (e.g. deleted choice) are skipped, not fatal.
    }
  }
  return cells;
}

// Synchronous cell conversion for a property type change. Returns the new
// cell value, or null when the value has no meaningful mapping (clear).
export function convertCellValue(
  oldProperty: BaseProperty,
  newType: string,
  newTypeOptions: Record<string, unknown>,
  value: unknown,
): unknown {
  if (value === null || value === undefined) return null;
  const oldType = oldProperty.type;
  if (oldType === newType) return value;

  const toText = (): string | null => {
    switch (oldType) {
      case 'select':
      case 'status': {
        const choice = asChoices(oldProperty).find((c) => c.id === value);
        return choice?.name ?? null;
      }
      case 'multiSelect': {
        const byId = new Map(asChoices(oldProperty).map((c) => [c.id, c.name]));
        const names = (Array.isArray(value) ? value : [])
          .map((id) => byId.get(id as string))
          .filter(Boolean);
        return names.length > 0 ? names.join(', ') : null;
      }
      case 'number':
        return String(value);
      case 'checkbox':
        return value === true ? 'true' : null;
      default:
        return typeof value === 'string' ? value : null;
    }
  };

  switch (newType) {
    case 'text':
    case 'longText':
      return toText();
    case 'url':
    case 'email':
    case 'date': {
      const text = toText();
      if (!text) return null;
      if (newType === 'date' && Number.isNaN(new Date(text).getTime())) {
        return null;
      }
      return text;
    }
    case 'number': {
      const text = toText();
      if (text === null) return null;
      const num = Number(text);
      return Number.isFinite(num) ? num : null;
    }
    case 'checkbox': {
      const text = (toText() ?? '').trim().toLowerCase();
      return ['true', 't', 'yes', 'y', 'on', '1'].includes(text) ? true : null;
    }
    case 'select':
    case 'status':
    case 'multiSelect': {
      const text = toText();
      if (!text) return null;
      const names =
        newType === 'multiSelect' && oldType !== 'multiSelect'
          ? text.split(',').map((s) => s.trim()).filter(Boolean)
          : [text];
      const choices = ((newTypeOptions as any)?.choices ?? []) as Choice[];
      const ids = names
        .map(
          (name) =>
            choices.find(
              (c) => c.name.trim().toLowerCase() === name.trim().toLowerCase(),
            )?.id,
        )
        .filter((id): id is string => Boolean(id));
      if (ids.length === 0) return null;
      return newType === 'multiSelect' ? ids : ids[0];
    }
    default:
      // person/page/file/relation and computed targets: no mapping.
      return null;
  }
}

// When converting text-ish values into select/multiSelect without choices
// provided, derive choices from the distinct existing values.
export function deriveChoicesFromTexts(texts: string[]): Choice[] {
  const seen = new Map<string, Choice>();
  const colors = [
    'gray',
    'blue',
    'green',
    'yellow',
    'red',
    'purple',
    'pink',
    'orange',
  ];
  for (const raw of texts) {
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.set(key, {
      id: generateBaseChoiceId(),
      name,
      color: colors[seen.size % colors.length],
    });
  }
  return Array.from(seen.values());
}
