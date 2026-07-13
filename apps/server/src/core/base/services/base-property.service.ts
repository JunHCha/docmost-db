import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { sql } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { BaseProperty, Page } from '@docmost/db/types/entity.types';
import { BasePropertyRepo } from '@docmost/db/repos/base/base-property.repo';
import { BaseRowRepo } from '@docmost/db/repos/base/base-row.repo';
import { generateBasePropertyId } from '../../../common/helpers/nanoid.utils';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { EventName } from '../../../common/events/event.contants';
import { serializeProperty } from '../base-events';
import { BASE_PROPERTY_TYPES, BasePropertyType } from '../base.types';
import {
  convertCellValue,
  deriveChoicesFromTexts,
  isReadonlyType,
} from '../engine/cell-values';
import { BaseFormulaService } from './base-formula.service';
import { BaseRelationService, relationOptionsOf } from './base-relation.service';

@Injectable()
export class BasePropertyService {
  private readonly logger = new Logger(BasePropertyService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly basePropertyRepo: BasePropertyRepo,
    private readonly baseRowRepo: BaseRowRepo,
    private readonly relationService: BaseRelationService,
    private readonly formulaService: BaseFormulaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private assertKnownType(type: string): asserts type is BasePropertyType {
    if (!BASE_PROPERTY_TYPES.includes(type as BasePropertyType)) {
      throw new BadRequestException(`unknown property type: ${type}`);
    }
  }

  private async assertUniqueName(
    pageId: string,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const properties = await this.basePropertyRepo.findLiveByPageId(pageId);
    const key = name.trim().toLowerCase();
    if (
      properties.some(
        (p) => p.id !== excludeId && p.name.trim().toLowerCase() === key,
      )
    ) {
      throw new BadRequestException('a property with that name already exists');
    }
  }

  async create(
    page: Page,
    dto: {
      name: string;
      type: string;
      typeOptions?: Record<string, unknown>;
      requestId?: string;
    },
    userId: string,
  ): Promise<BaseProperty> {
    this.assertKnownType(dto.type);
    await this.assertUniqueName(page.id, dto.name);
    const properties = await this.basePropertyRepo.findLiveByPageId(page.id);
    let typeOptions: Record<string, unknown> = dto.typeOptions ?? {};

    if (dto.type === 'formula') {
      typeOptions = this.formulaService.buildTypeOptions(
        (typeOptions as any)?.source,
        properties,
        null,
        (typeOptions as any)?.formatOptions,
      ) as any;
    }

    let targetPage: Page | null = null;
    if (dto.type === 'relation') {
      const targetPageId = (typeOptions as any)?.targetPageId;
      if (typeof targetPageId !== 'string') {
        throw new BadRequestException('relation requires targetPageId');
      }
      targetPage = await this.relationService.resolveTargetBase(
        targetPageId,
        page.workspaceId,
      );
      await this.relationService.assertNoDuplicateTarget(
        page.id,
        targetPageId,
      );
      typeOptions = { targetPageId, relatedPropertyId: null };
    }

    const last = properties[properties.length - 1];
    const property = await this.basePropertyRepo.insert({
      id: generateBasePropertyId(),
      pageId: page.id,
      name: dto.name,
      type: dto.type,
      position: generateJitteredKeyBetween(last?.position ?? null, null),
      typeOptions: typeOptions as any,
      isPrimary: false,
      workspaceId: page.workspaceId,
    });

    if (dto.type === 'relation' && targetPage) {
      const reverse = await this.relationService.pairReverse(
        property,
        page.title,
        targetPage,
      );
      this.eventEmitter.emit(EventName.BASE_PROPERTY_CREATED, {
        operation: 'base:property:created',
        pageId: targetPage.id,
        property: serializeProperty(reverse),
      });
      (property.typeOptions as any).relatedPropertyId = reverse.id;
    }

    if (dto.type === 'formula') {
      const all = await this.basePropertyRepo.findLiveByPageId(page.id);
      await this.formulaService.recomputeAll(page.id, [property], all);
    }

    await this.bumpSchemaVersion(page.id);
    this.eventEmitter.emit(EventName.BASE_PROPERTY_CREATED, {
      operation: 'base:property:created',
      pageId: page.id,
      property: serializeProperty(property),
      requestId: dto.requestId,
    });
    return property;
  }

  async update(
    page: Page,
    dto: {
      propertyId: string;
      name?: string;
      type?: string;
      typeOptions?: Record<string, unknown>;
      requestId?: string;
    },
  ): Promise<{ property: BaseProperty; jobId: string | null }> {
    const property = await this.basePropertyRepo.findById(
      page.id,
      dto.propertyId,
    );
    if (!property || property.deletedAt) {
      throw new NotFoundException('property not found');
    }

    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined && dto.name !== property.name) {
      await this.assertUniqueName(page.id, dto.name, property.id);
      patch.name = dto.name;
    }

    const wantsTypeChange =
      dto.type !== undefined && dto.type !== property.type;

    if (wantsTypeChange) {
      this.assertKnownType(dto.type);
      if (property.type === 'relation' || dto.type === 'relation') {
        // Relations pair with a reverse column on another base; type
        // morphing would strand the pair. Delete and recreate instead.
        throw new BadRequestException(
          'relation properties cannot change type; delete and recreate instead',
        );
      }
      if (isReadonlyType(dto.type) && dto.type !== 'formula') {
        throw new BadRequestException(
          `cannot convert into computed type ${dto.type}`,
        );
      }
      const updated = await this.convertType(page, property, dto);
      return { property: updated, jobId: null };
    }

    if (dto.typeOptions !== undefined) {
      if (property.type === 'formula') {
        const all = await this.basePropertyRepo.findLiveByPageId(page.id);
        patch.typeOptions = this.formulaService.buildTypeOptions(
          (dto.typeOptions as any)?.source ??
            (property.typeOptions as any)?.source,
          all.filter((p) => p.id !== property.id),
          property.id,
          (dto.typeOptions as any)?.formatOptions,
        ) as any;
      } else if (property.type === 'relation') {
        const options = relationOptionsOf(property);
        const nextTarget = (dto.typeOptions as any)?.targetPageId;
        if (
          typeof nextTarget === 'string' &&
          nextTarget !== options?.targetPageId
        ) {
          // Retargeting re-pairs: soft-delete the old reverse and create a
          // fresh one on the new target.
          const targetPage = await this.relationService.resolveTargetBase(
            nextTarget,
            page.workspaceId,
          );
          await this.relationService.assertNoDuplicateTarget(
            page.id,
            nextTarget,
            property.id,
          );
          const oldReverse =
            await this.relationService.cascadeDeletePair(property);
          if (oldReverse) {
            this.eventEmitter.emit(EventName.BASE_PROPERTY_DELETED, {
              operation: 'base:property:deleted',
              pageId: oldReverse.pageId,
              propertyId: oldReverse.id,
            });
          }
          const retargeted = await this.basePropertyRepo.update(
            page.id,
            property.id,
            {
              typeOptions: {
                targetPageId: nextTarget,
                relatedPropertyId: null,
              } as any,
            },
          );
          const reverse = await this.relationService.pairReverse(
            retargeted,
            page.title,
            targetPage,
          );
          this.eventEmitter.emit(EventName.BASE_PROPERTY_CREATED, {
            operation: 'base:property:created',
            pageId: targetPage.id,
            property: serializeProperty(reverse),
          });
          // Old links point at rows of the previous target: clear them.
          await this.clearAllCells(page.id, property.id);
        }
        patch.typeOptions = {
          ...(property.typeOptions as any),
          ...(dto.typeOptions as any),
          targetPageId:
            typeof nextTarget === 'string'
              ? nextTarget
              : options?.targetPageId,
        } as any;
      } else {
        patch.typeOptions = {
          ...(property.typeOptions as any),
          ...(dto.typeOptions as any),
        } as any;
      }
    }

    const updated =
      Object.keys(patch).length > 0
        ? await this.basePropertyRepo.update(page.id, property.id, patch)
        : property;

    if (property.type === 'formula' && patch.typeOptions) {
      const all = await this.basePropertyRepo.findLiveByPageId(page.id);
      await this.formulaService.recomputeAll(page.id, [updated], all);
    }

    this.eventEmitter.emit(EventName.BASE_PROPERTY_UPDATED, {
      operation: 'base:property:updated',
      pageId: page.id,
      property: serializeProperty(updated),
      requestId: dto.requestId,
    });
    return { property: updated, jobId: null };
  }

  // Synchronous type conversion: rewrite every live cell, commit the new
  // type, bump the schema version. Returns jobId:null semantics upstream
  // reserves for sync conversions.
  private async convertType(
    page: Page,
    property: BaseProperty,
    dto: { type?: string; typeOptions?: Record<string, unknown> },
  ): Promise<BaseProperty> {
    const newType = dto.type as string;
    let newTypeOptions: Record<string, unknown> = dto.typeOptions ?? {};

    if (newType === 'formula') {
      const all = await this.basePropertyRepo.findLiveByPageId(page.id);
      newTypeOptions = this.formulaService.buildTypeOptions(
        (newTypeOptions as any)?.source,
        all.filter((p) => p.id !== property.id),
        property.id,
        (newTypeOptions as any)?.formatOptions,
      ) as any;
    }

    const rows = await this.baseRowRepo.findAllLive(page.id);

    // text -> select/multiSelect without explicit choices derives options
    // from the existing values.
    if (
      ['select', 'status', 'multiSelect'].includes(newType) &&
      !(newTypeOptions as any)?.choices?.length
    ) {
      const texts = rows
        .flatMap((row) => {
          const value = (row.cells as any)?.[property.id];
          if (typeof value !== 'string') return [];
          return newType === 'multiSelect'
            ? value.split(',').map((s) => s.trim())
            : [value];
        })
        .filter(Boolean);
      const choices = deriveChoicesFromTexts(
        property.type === 'select' || property.type === 'multiSelect'
          ? ((property.typeOptions as any)?.choices ?? []).map(
              (c: any) => c.name,
            )
          : texts,
      );
      newTypeOptions = {
        ...newTypeOptions,
        choices,
        choiceOrder: choices.map((c) => c.id),
      };
    }

    for (const row of rows) {
      const value = (row.cells as any)?.[property.id];
      if (value === undefined || value === null) continue;
      const converted =
        newType === 'formula'
          ? null
          : convertCellValue(property, newType, newTypeOptions, value);
      if (converted !== value) {
        await this.baseRowRepo.setCellValue(row.id, property.id, converted);
      }
    }

    const updated = await this.basePropertyRepo.update(page.id, property.id, {
      type: newType,
      typeOptions: newTypeOptions as any,
      schemaVersion: (property.schemaVersion ?? 1) + 1,
    });

    if (newType === 'formula') {
      const all = await this.basePropertyRepo.findLiveByPageId(page.id);
      await this.formulaService.recomputeAll(page.id, [updated], all);
    }

    const schemaVersion = await this.bumpSchemaVersion(page.id);
    this.eventEmitter.emit(EventName.BASE_SCHEMA_BUMPED, {
      operation: 'base:schema:bumped',
      pageId: page.id,
      schemaVersion,
    });
    return updated;
  }

  async delete(
    page: Page,
    dto: { propertyId: string; requestId?: string },
  ): Promise<void> {
    const property = await this.basePropertyRepo.findById(
      page.id,
      dto.propertyId,
    );
    if (!property || property.deletedAt) {
      throw new NotFoundException('property not found');
    }
    if (property.isPrimary) {
      throw new BadRequestException('the primary property cannot be deleted');
    }

    await this.basePropertyRepo.softDelete(page.id, property.id);
    const reverse = await this.relationService.cascadeDeletePair(property);
    if (reverse) {
      this.eventEmitter.emit(EventName.BASE_PROPERTY_DELETED, {
        operation: 'base:property:deleted',
        pageId: reverse.pageId,
        propertyId: reverse.id,
      });
      await this.baseRowRepo.removeCellKey(reverse.pageId, reverse.id);
    }
    await this.baseRowRepo.removeCellKey(page.id, property.id);
    await this.bumpSchemaVersion(page.id);

    this.eventEmitter.emit(EventName.BASE_PROPERTY_DELETED, {
      operation: 'base:property:deleted',
      pageId: page.id,
      propertyId: property.id,
      requestId: dto.requestId,
    });
  }

  async reorder(
    page: Page,
    dto: { propertyId: string; position: string; requestId?: string },
  ): Promise<void> {
    const property = await this.basePropertyRepo.findById(
      page.id,
      dto.propertyId,
    );
    if (!property || property.deletedAt) {
      throw new NotFoundException('property not found');
    }
    const updated = await this.basePropertyRepo.update(page.id, property.id, {
      position: dto.position,
    });
    this.eventEmitter.emit(EventName.BASE_PROPERTY_REORDERED, {
      operation: 'base:property:reordered',
      pageId: page.id,
      property: serializeProperty(updated),
      requestId: dto.requestId,
    });
  }

  private async clearAllCells(pageId: string, propertyId: string) {
    await this.baseRowRepo.removeCellKey(pageId, propertyId);
  }

  private async bumpSchemaVersion(pageId: string): Promise<number> {
    const result = await this.db
      .updateTable('pages')
      .set({
        baseSchemaVersion: sql`base_schema_version + 1`,
      })
      .where('id', '=', pageId)
      .returning('baseSchemaVersion')
      .executeTakeFirst();
    return result?.baseSchemaVersion ?? 0;
  }
}
