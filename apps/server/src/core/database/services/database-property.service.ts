import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { DatabasePropertyRepo } from '@docmost/db/repos/database/database-property.repo';
import { DatabaseRepo } from '@docmost/db/repos/database/database.repo';
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
    return this.propertyRepo.findById(dto.propertyId);
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
