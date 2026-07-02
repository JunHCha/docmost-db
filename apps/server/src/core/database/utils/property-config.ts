import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';

// Core property types (see docs/database-feature/data-model.md).
export const PROPERTY_TYPES = [
  'text',
  'number',
  'date',
  'select',
  'multi_select',
  'checkbox',
  'url',
  'relation',
  'person',
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

export interface SelectOption {
  id: string;
  label: string;
  color?: string;
}

export function isPropertyType(type: string): type is PropertyType {
  return (PROPERTY_TYPES as readonly string[]).includes(type);
}

export function assertPropertyType(type: string): asserts type is PropertyType {
  if (!isPropertyType(type)) {
    throw new BadRequestException(`Unsupported property type: ${type}`);
  }
}

/**
 * Validate and normalize a property's `config` jsonb for the given type.
 * Pure (shape only) — the existence of a relation's target database is checked
 * separately in the service (needs DB access). See conventions.md §2.
 */
export function normalizePropertyConfig(
  type: PropertyType,
  config: unknown,
): Record<string, any> {
  const cfg: Record<string, any> =
    config && typeof config === 'object' ? (config as any) : {};

  if (type === 'select' || type === 'multi_select') {
    const rawOptions = cfg.options;
    if (!Array.isArray(rawOptions)) {
      throw new BadRequestException(
        `'${type}' config requires an 'options' array`,
      );
    }
    const options: SelectOption[] = rawOptions.map((opt: any) => {
      if (!opt || typeof opt !== 'object' || typeof opt.label !== 'string') {
        throw new BadRequestException('Each select option needs a string label');
      }
      return {
        id: typeof opt.id === 'string' && opt.id ? opt.id : randomUUID(),
        label: opt.label,
        ...(typeof opt.color === 'string' ? { color: opt.color } : {}),
      };
    });
    return { options };
  }

  if (type === 'relation') {
    const targetDatabaseId = cfg.targetDatabaseId;
    if (typeof targetDatabaseId !== 'string' || !targetDatabaseId) {
      throw new BadRequestException(
        "'relation' config requires a 'targetDatabaseId'",
      );
    }
    // relatedPropertyId pairs this relation with its reverse column in the
    // target db (bidirectional). Preserved when present; the service fills it
    // in after creating the reverse property. See data-model.md (relation).
    const relatedPropertyId = cfg.relatedPropertyId;
    return {
      targetDatabaseId,
      ...(typeof relatedPropertyId === 'string' && relatedPropertyId
        ? { relatedPropertyId }
        : {}),
    };
  }

  // text / number / date / checkbox / url / person carry no config.
  // A person value is an array of workspace user ids (validated in
  // property-value.ts), so no per-column configuration is needed.
  return {};
}
