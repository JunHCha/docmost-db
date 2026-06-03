import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

    const siblings = await this.propertyRepo.findByDatabaseId(dto.databaseId);
    const last = siblings[siblings.length - 1];
    const position = generateJitteredKeyBetween(last?.position ?? null, null);

    return this.propertyRepo.insertProperty({
      databaseId: dto.databaseId,
      name: dto.name,
      type: dto.type,
      config,
      position,
    });
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

    const patch: UpdatableDatabaseProperty = {};
    if (dto.name !== undefined) patch.name = dto.name;

    const typeChanged = dto.type !== undefined && dto.type !== property.type;
    if (dto.type !== undefined) {
      assertPropertyType(dto.type);
      patch.type = dto.type;
    }

    // Re-validate config whenever the type changes or a new config is supplied.
    // Config is full-replace: for select/multi_select the client must echo the
    // existing options (with their ids) — ids are preserved only when sent back,
    // so omitting them regenerates ids. Changing the type discards the old
    // config; existing property values are NOT migrated here (see #5).
    if (typeChanged || dto.config !== undefined) {
      const nextType = (dto.type ?? property.type) as PropertyType;
      const rawConfig =
        dto.config ?? (typeChanged ? {} : (property.config as object));
      patch.config = await this.resolveConfig(nextType, rawConfig, database);
    }

    await this.propertyRepo.updateProperty(patch, dto.propertyId);

    if (typeChanged && (oldType === 'select' || oldType === 'multi_select')) {
      const newType = dto.type as PropertyType;
      if (newType !== 'select' && newType !== 'multi_select') {
        await this.migrateOptionValues(
          database,
          oldType,
          oldOptions,
          newType,
          dto.propertyId,
        );
      }
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
    const rows = await this.databaseRepo.listRows(database.pageId);
    const pageIds = rows.map((r) => r.id);
    const values = (await this.valueRepo.findByPageIds(pageIds)).filter(
      (v) => v.propertyId === propertyId,
    );

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
    await this.getPropertyDatabase(user, dto.propertyId, SpaceCaslAction.Edit);
    await this.propertyRepo.softDeleteProperty(dto.propertyId);
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
