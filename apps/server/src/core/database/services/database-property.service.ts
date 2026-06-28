import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { DatabasePropertyRepo } from '@docmost/db/repos/database/database-property.repo';
import { DatabaseRepo } from '@docmost/db/repos/database/database.repo';
import { DatabasePropertyValueRepo } from '@docmost/db/repos/database/database-property-value.repo';
import SpaceAbilityFactory from '../../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../casl/interfaces/space-ability.type';
import {
  Database,
  DatabaseProperty,
  DatabasePropertyValue,
  UpdatableDatabaseProperty,
  User,
} from '@docmost/db/types/entity.types';
import {
  assertPropertyType,
  normalizePropertyConfig,
  PropertyType,
  SelectOption,
} from '../utils/property-config';
import { CreatePropertyDto } from '../dto/create-property.dto';
import { UpdatePropertyDto } from '../dto/update-property.dto';
import { ReorderPropertyDto } from '../dto/reorder-property.dto';
import { PropertyIdDto } from '../dto/property-id.dto';
import { ListPropertiesDto } from '../dto/list-properties.dto';

// Frontend option-colors palette keys (excluding 'default'); cycled when
// auto-deriving select options from text values.
const OPTION_COLORS = [
  'gray',
  'brown',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'red',
] as const;

@Injectable()
export class DatabasePropertyService {
  constructor(
    private readonly propertyRepo: DatabasePropertyRepo,
    private readonly databaseRepo: DatabaseRepo,
    private readonly valueRepo: DatabasePropertyValueRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
  ) {}

  async create(user: User, dto: CreatePropertyDto): Promise<DatabaseProperty> {
    const database = await this.authorize(
      user,
      dto.databaseId,
      SpaceCaslAction.Edit,
    );
    assertPropertyType(dto.type);
    const config = await this.resolveConfig(dto.type, dto.config, database);

    const position = await this.nextPosition(dto.databaseId);

    const property = await this.propertyRepo.insertProperty({
      databaseId: dto.databaseId,
      name: dto.name,
      type: dto.type,
      config,
      position,
    });

    if (dto.type === 'relation') {
      // NOT atomic: the repos accept a trx but the service runs sequentially,
      // so a failure mid-pairing can leave a half-linked reverse column. We
      // accept this (matching the repo's non-atomic convention) since relation
      // creation is rare and self-healing on the next edit. See conventions.md.
      return this.pairReverseRelation(property, config.targetDatabaseId);
    }

    return property;
  }

  async update(user: User, dto: UpdatePropertyDto): Promise<DatabaseProperty> {
    const { property, database } = await this.getPropertyDatabase(
      user,
      dto.propertyId,
      SpaceCaslAction.Edit,
    );

    // Capture the old type/options before the config (option labels) is
    // discarded, so values can be migrated from option ids to labels below.
    const oldType = property.type as PropertyType;
    const oldOptions = ((property.config as any)?.options ?? []) as SelectOption[];

    // A relation's type is locked: its reverse pairing would be orphaned by a
    // type change. Delete it instead (which cascades to the reverse column).
    if (
      oldType === 'relation' &&
      dto.type !== undefined &&
      dto.type !== 'relation'
    ) {
      throw new BadRequestException(
        'relation property type cannot be changed; delete instead',
      );
    }

    const patch: UpdatableDatabaseProperty = {};
    if (dto.name !== undefined) patch.name = dto.name;

    const typeChanged = dto.type !== undefined && dto.type !== property.type;
    if (dto.type !== undefined) {
      assertPropertyType(dto.type);
      patch.type = dto.type;
    }
    const newType = dto.type as PropertyType;

    // text/url -> select/multi_select: derive options from the existing string
    // values instead of any client-supplied config, so the new options exist
    // before values are converted to their ids below.
    const stringToOption =
      typeChanged &&
      (oldType === 'text' || oldType === 'url') &&
      (newType === 'select' || newType === 'multi_select');
    let derivedValues: DatabasePropertyValue[] = [];
    let derivedOptions: SelectOption[] = [];

    if (stringToOption) {
      derivedValues = await this.loadPropertyValues(database, dto.propertyId);
      derivedOptions = this.deriveOptionsFromValues(derivedValues);
      patch.config = { options: derivedOptions } as Record<string, any>;
    } else if (typeChanged || dto.config !== undefined) {
      // Re-validate config whenever the type changes or a new config is
      // supplied. Config is full-replace: for select/multi_select the client
      // must echo the existing options (with their ids) — ids are preserved
      // only when sent back, so omitting them regenerates ids. Changing the
      // type discards the old config.
      const nextType = (dto.type ?? property.type) as PropertyType;
      const rawConfig =
        dto.config ?? (typeChanged ? {} : (property.config as object));
      patch.config = await this.resolveConfig(nextType, rawConfig, database);
    }

    await this.propertyRepo.updateProperty(patch, dto.propertyId);

    // Relation pairing side effects. NOT atomic (see create()'s note): the
    // reverse-column create/soft-delete run as separate statements. Only runs
    // when config was (re)validated this update (patch.config present).
    const effectiveType = (dto.type ?? property.type) as PropertyType;
    if (effectiveType === 'relation' && patch.config) {
      const newTarget = (patch.config as any)?.targetDatabaseId as string;

      // `property` carries the source id/databaseId/name loaded above.
      if (oldType !== 'relation') {
        // other type -> relation: create the reverse pairing.
        await this.pairReverseRelation(property, newTarget);
      } else {
        const oldConfig = property.config as any;
        const oldTarget = oldConfig?.targetDatabaseId as string;
        if (newTarget !== oldTarget) {
          // target changed: drop the old reverse pair, build a new one.
          if (oldConfig?.relatedPropertyId) {
            await this.propertyRepo.softDeleteProperty(
              oldConfig.relatedPropertyId,
            );
          }
          await this.pairReverseRelation(property, newTarget);
        }
      }
    }

    if (typeChanged && (oldType === 'select' || oldType === 'multi_select')) {
      if (newType !== 'select' && newType !== 'multi_select') {
        await this.migrateOptionValues(
          database,
          oldType,
          oldOptions,
          newType,
          dto.propertyId,
        );
      }
    } else if (stringToOption) {
      await this.migrateStringValues(
        derivedOptions,
        newType,
        dto.propertyId,
        derivedValues,
      );
    }

    return this.propertyRepo.findById(dto.propertyId);
  }

  // Convert stale option-id values when a select/multi_select property changes
  // to a non-option type. String types (text/url) keep the option labels;
  // other types cannot represent labels, so their values are cleared.
  private async migrateOptionValues(
    database: Database,
    oldType: PropertyType,
    oldOptions: SelectOption[],
    newType: PropertyType,
    propertyId: string,
  ): Promise<void> {
    const labelById = new Map(oldOptions.map((o) => [o.id, o.label]));
    const values = await this.loadPropertyValues(database, propertyId);

    const toLabel = newType === 'text' || newType === 'url';

    for (const v of values) {
      const raw = v.value as { type: string; value: unknown };

      if (!toLabel) {
        await this.valueRepo.clearValue(v.pageId, propertyId);
        continue;
      }

      let label = '';
      if (oldType === 'multi_select') {
        label = (Array.isArray(raw?.value) ? raw.value : [])
          .map((id) => labelById.get(id as string))
          .filter(Boolean)
          .join(', ');
      } else {
        label = labelById.get(raw?.value as string) ?? '';
      }

      if (label) {
        await this.valueRepo.setValue({
          pageId: v.pageId,
          propertyId,
          value: { type: newType, value: label },
        });
      } else {
        await this.valueRepo.clearValue(v.pageId, propertyId);
      }
    }
  }

  // Build select options from existing string values: trim, drop blanks, and
  // dedupe case-insensitively (keeping the first label's casing). Colors cycle
  // through a small palette matching the frontend option-colors keys.
  private deriveOptionsFromValues(
    values: DatabasePropertyValue[],
  ): SelectOption[] {
    const seen = new Map<string, SelectOption>();
    let i = 0;
    for (const v of values) {
      const raw = v.value as { value?: unknown };
      const label = typeof raw?.value === 'string' ? raw.value.trim() : '';
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.set(key, {
        id: randomUUID(),
        label,
        color: OPTION_COLORS[i % OPTION_COLORS.length],
      });
      i += 1;
    }
    return [...seen.values()];
  }

  // Convert each existing string value to the derived option id. select stores
  // the id directly; multi_select wraps it in a one-element array. Rows whose
  // text is blank (no matching option) are cleared.
  private async migrateStringValues(
    options: SelectOption[],
    newType: PropertyType,
    propertyId: string,
    values: DatabasePropertyValue[],
  ): Promise<void> {
    const idByLabel = new Map(
      options.map((o) => [o.label.trim().toLowerCase(), o.id]),
    );
    for (const v of values) {
      const raw = v.value as { value?: unknown };
      const label = typeof raw?.value === 'string' ? raw.value.trim() : '';
      const id = label ? idByLabel.get(label.toLowerCase()) : undefined;
      if (id) {
        await this.valueRepo.setValue({
          pageId: v.pageId,
          propertyId,
          value:
            newType === 'multi_select'
              ? { type: 'multi_select', value: [id] }
              : { type: 'select', value: id },
        });
      } else {
        await this.valueRepo.clearValue(v.pageId, propertyId);
      }
    }
  }

  // Load all values for one property across the database's rows.
  private async loadPropertyValues(
    database: Database,
    propertyId: string,
  ): Promise<DatabasePropertyValue[]> {
    const rows = await this.databaseRepo.listRows(database.pageId);
    const pageIds = rows.map((r) => r.id);
    return (await this.valueRepo.findByPageIds(pageIds)).filter(
      (v) => v.propertyId === propertyId,
    );
  }

  // Append position for a new property in the given database.
  private async nextPosition(databaseId: string): Promise<string> {
    const siblings = await this.propertyRepo.findByDatabaseId(databaseId);
    const last = siblings[siblings.length - 1];
    return generateJitteredKeyBetween(last?.position ?? null, null);
  }

  // Create the reverse relation column in `targetDatabaseId` pointing back at
  // `source`, then patch the source config with the reverse property's id so
  // both sides reference each other (config.relatedPropertyId). View configs
  // are intentionally left untouched: resolveColumns renders config-absent
  // properties as visible, so the reverse column auto-shows without marking
  // sibling view drafts dirty (see issue #111). Returns the patched source.
  private async pairReverseRelation(
    source: DatabaseProperty,
    targetDatabaseId: string,
  ): Promise<DatabaseProperty> {
    const reverse = await this.propertyRepo.insertProperty({
      databaseId: targetDatabaseId,
      name: `Related to ${source.name}`,
      type: 'relation',
      config: {
        targetDatabaseId: source.databaseId,
        relatedPropertyId: source.id,
      },
      position: await this.nextPosition(targetDatabaseId),
    });

    const sourceConfig = {
      targetDatabaseId,
      relatedPropertyId: reverse.id,
    };
    await this.propertyRepo.updateProperty(
      { config: sourceConfig },
      source.id,
    );

    return { ...source, config: sourceConfig } as DatabaseProperty;
  }

  async reorder(user: User, dto: ReorderPropertyDto): Promise<void> {
    const { database } = await this.getPropertyDatabase(
      user,
      dto.propertyId,
      SpaceCaslAction.Edit,
    );

    const siblings = (
      await this.propertyRepo.findByDatabaseId(database.id)
    ).filter((p) => p.id !== dto.propertyId);

    let afterPos: string | null = null;
    let beforePos: string | null = null;
    if (dto.afterPropertyId) {
      if (dto.afterPropertyId === dto.propertyId) {
        throw new BadRequestException(
          'afterPropertyId cannot be the property itself',
        );
      }
      const idx = siblings.findIndex((p) => p.id === dto.afterPropertyId);
      if (idx === -1) {
        throw new NotFoundException('afterProperty not found');
      }
      afterPos = siblings[idx].position;
      beforePos = siblings[idx + 1]?.position ?? null;
    } else {
      beforePos = siblings[0]?.position ?? null;
    }

    const position = generateJitteredKeyBetween(afterPos, beforePos);
    await this.propertyRepo.updateProperty({ position }, dto.propertyId);
  }

  async delete(user: User, dto: PropertyIdDto): Promise<void> {
    const { property } = await this.getPropertyDatabase(
      user,
      dto.propertyId,
      SpaceCaslAction.Edit,
    );
    await this.propertyRepo.softDeleteProperty(dto.propertyId);

    // Cascade to the paired reverse column so the bidirectional link stays
    // consistent. NOT atomic (see create()'s note). Value cleanup is handled
    // separately (Phase C / row service); this removes the column only.
    if (property.type === 'relation') {
      const relatedPropertyId = (property.config as any)?.relatedPropertyId;
      if (relatedPropertyId) {
        await this.propertyRepo.softDeleteProperty(relatedPropertyId);
      }
    }
  }

  async list(
    user: User,
    dto: ListPropertiesDto,
  ): Promise<DatabaseProperty[]> {
    await this.authorize(user, dto.databaseId, SpaceCaslAction.Read);
    return this.propertyRepo.findByDatabaseId(dto.databaseId);
  }

  // --- helpers ---

  private async authorize(
    user: User,
    databaseId: string,
    action: SpaceCaslAction,
  ): Promise<Database> {
    const database = await this.databaseRepo.findById(databaseId);
    if (!database) {
      throw new NotFoundException('Database not found');
    }
    const ability = await this.spaceAbility.createForUser(
      user,
      database.spaceId,
    );
    if (ability.cannot(action, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }
    return database;
  }

  private async getPropertyDatabase(
    user: User,
    propertyId: string,
    action: SpaceCaslAction,
  ): Promise<{ property: DatabaseProperty; database: Database }> {
    const property = await this.propertyRepo.findById(propertyId);
    if (!property) {
      throw new NotFoundException('Property not found');
    }
    const database = await this.authorize(user, property.databaseId, action);
    return { property, database };
  }

  private async resolveConfig(
    type: PropertyType,
    config: unknown,
    database: Database,
  ): Promise<Record<string, any>> {
    const normalized = normalizePropertyConfig(type, config);
    if (type === 'relation') {
      const target = await this.databaseRepo.findById(
        normalized.targetDatabaseId as string,
      );
      if (!target || target.workspaceId !== database.workspaceId) {
        throw new BadRequestException('relation target database not found');
      }
    }
    return normalized;
  }
}
