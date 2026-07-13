import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { BaseProperty, Page } from '@docmost/db/types/entity.types';
import { BasePropertyRepo } from '@docmost/db/repos/base/base-property.repo';
import { BaseRowRepo } from '@docmost/db/repos/base/base-row.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { generateBasePropertyId } from '../../../common/helpers/nanoid.utils';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { RelationTypeOptions } from '../base.types';

export function relationOptionsOf(
  property: BaseProperty,
): RelationTypeOptions | null {
  if (property.type !== 'relation') return null;
  const options = property.typeOptions as RelationTypeOptions | null;
  if (!options?.targetPageId) return null;
  return options;
}

export function readRelationIds(cellValue: unknown): string[] {
  if (!Array.isArray(cellValue)) return [];
  return cellValue.filter((v): v is string => typeof v === 'string');
}

// Fork feature: bidirectional relation properties between two bases.
// Values are arrays of target base_rows ids stored in cells. Writing one
// side mirrors the link into the paired reverse property on the target
// rows. Mirroring is sequential/non-atomic; the client re-syncs on error.
@Injectable()
export class BaseRelationService {
  private readonly logger = new Logger(BaseRelationService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly basePropertyRepo: BasePropertyRepo,
    private readonly baseRowRepo: BaseRowRepo,
    private readonly pageRepo: PageRepo,
  ) {}

  async resolveTargetBase(
    targetPageId: string,
    workspaceId: string,
  ): Promise<Page> {
    const target = await this.pageRepo.findById(targetPageId);
    if (
      !target ||
      target.deletedAt ||
      !target.isBase ||
      target.workspaceId !== workspaceId
    ) {
      throw new NotFoundException('relation target base not found');
    }
    return target;
  }

  // A base may hold only one live relation property per target, except
  // the auto-created reverse of a self-relation pair.
  async assertNoDuplicateTarget(
    pageId: string,
    targetPageId: string,
    excludePropertyId?: string,
  ): Promise<void> {
    const properties = await this.basePropertyRepo.findLiveByPageId(pageId);
    const duplicate = properties.find((p) => {
      if (p.id === excludePropertyId) return false;
      const options = relationOptionsOf(p);
      return options?.targetPageId === targetPageId;
    });
    if (duplicate) {
      throw new BadRequestException(
        'a relation to that base already exists on this base',
      );
    }
  }

  // Creates the reverse property on the target base and links the pair.
  // Non-atomic across bases by design; a missing relatedPropertyId simply
  // disables mirroring (self-heals when re-paired).
  async pairReverse(
    source: BaseProperty,
    sourceBaseTitle: string | null,
    targetPage: Page,
  ): Promise<BaseProperty> {
    const targetProps = await this.basePropertyRepo.findLiveByPageId(
      targetPage.id,
    );
    const last = targetProps[targetProps.length - 1];
    const reverse = await this.basePropertyRepo.insert({
      id: generateBasePropertyId(),
      pageId: targetPage.id,
      name: this.reverseName(sourceBaseTitle, targetProps),
      type: 'relation',
      position: generateJitteredKeyBetween(last?.position ?? null, null),
      typeOptions: {
        targetPageId: source.pageId,
        relatedPropertyId: source.id,
      } as any,
      isPrimary: false,
      workspaceId: source.workspaceId,
    });

    await this.basePropertyRepo.update(source.pageId, source.id, {
      typeOptions: {
        ...(source.typeOptions as any),
        relatedPropertyId: reverse.id,
      } as any,
    });
    return reverse;
  }

  private reverseName(
    sourceBaseTitle: string | null,
    existing: BaseProperty[],
  ): string {
    const base = `Related to ${sourceBaseTitle || 'Untitled base'}`;
    const names = new Set(
      existing.map((p) => p.name.trim().toLowerCase()),
    );
    if (!names.has(base.trim().toLowerCase())) return base;
    for (let i = 2; ; i++) {
      const candidate = `${base} (${i})`;
      if (!names.has(candidate.toLowerCase())) return candidate;
    }
  }

  // Every linked id must be a live row of the target base.
  async assertMembership(
    property: BaseProperty,
    rowIds: string[],
  ): Promise<void> {
    if (rowIds.length === 0) return;
    const options = relationOptionsOf(property);
    if (!options) {
      throw new BadRequestException('malformed relation property');
    }
    const live = await this.baseRowRepo.findLiveByIds(
      options.targetPageId,
      rowIds,
    );
    if (live.length !== new Set(rowIds).size) {
      throw new BadRequestException(
        'relation value contains rows outside the target base',
      );
    }
  }

  // Mirrors a relation cell write into the paired reverse property of the
  // target rows. Returns the set of touched target rows so callers can
  // emit row-updated events for the target base's room.
  async mirror(
    property: BaseProperty,
    sourceRowId: string,
    oldIds: string[],
    newIds: string[],
  ): Promise<{ targetPageId: string; touchedRowIds: string[] }> {
    const options = relationOptionsOf(property);
    if (!options?.relatedPropertyId) {
      return { targetPageId: options?.targetPageId ?? '', touchedRowIds: [] };
    }
    const added = newIds.filter((id) => !oldIds.includes(id));
    const removed = oldIds.filter((id) => !newIds.includes(id));
    const touched: string[] = [];

    for (const targetRowId of added) {
      const target = await this.baseRowRepo.findById(targetRowId);
      if (!target || target.deletedAt) continue;
      const current = readRelationIds(
        (target.cells as any)?.[options.relatedPropertyId],
      );
      if (current.includes(sourceRowId)) continue;
      await this.baseRowRepo.setCellValue(
        targetRowId,
        options.relatedPropertyId,
        [...current, sourceRowId],
      );
      touched.push(targetRowId);
    }

    for (const targetRowId of removed) {
      const target = await this.baseRowRepo.findById(targetRowId);
      if (!target || target.deletedAt) continue;
      const current = readRelationIds(
        (target.cells as any)?.[options.relatedPropertyId],
      );
      if (!current.includes(sourceRowId)) continue;
      const next = current.filter((id) => id !== sourceRowId);
      await this.baseRowRepo.setCellValue(
        targetRowId,
        options.relatedPropertyId,
        next.length > 0 ? next : null,
      );
      touched.push(targetRowId);
    }

    return { targetPageId: options.targetPageId, touchedRowIds: touched };
  }

  // Deleting a relation property soft-deletes its paired reverse too.
  async cascadeDeletePair(property: BaseProperty): Promise<BaseProperty | null> {
    const options = relationOptionsOf(property);
    if (!options?.relatedPropertyId) return null;
    const reverse = await this.basePropertyRepo.findById(
      options.targetPageId,
      options.relatedPropertyId,
    );
    if (!reverse || reverse.deletedAt) return null;
    await this.basePropertyRepo.softDelete(reverse.pageId, reverse.id);
    return reverse;
  }
}
