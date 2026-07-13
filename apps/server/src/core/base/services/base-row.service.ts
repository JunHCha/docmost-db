import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { BaseProperty, BaseRow, Page, User } from '@docmost/db/types/entity.types';
import { BasePropertyRepo } from '@docmost/db/repos/base/base-property.repo';
import { BaseRowRepo, ListRowsResult } from '@docmost/db/repos/base/base-row.repo';
import { BaseTemplateRepo } from '@docmost/db/repos/base/base-template.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PageService } from '../../page/services/page.service';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { EventName } from '../../../common/events/event.contants';
import { serializeRow } from '../base-events';
import {
  FilterNode,
  ResolvedPage,
  RowReferences,
  ViewSortConfig,
} from '../base.types';
import { isReadonlyType, normalizeCellValue } from '../engine/cell-values';
import { BaseFormulaService } from './base-formula.service';
import { BaseRelationService, readRelationIds, relationOptionsOf } from './base-relation.service';

// Fork extension of upstream RowReferences: relation cells resolve their
// chips from `rows` (target row id -> primary cell text).
export type ForkRowReferences = RowReferences & {
  rows?: Record<string, { id: string; pageId: string; title: string | null }>;
};

@Injectable()
export class BaseRowService {
  private readonly logger = new Logger(BaseRowService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly baseRowRepo: BaseRowRepo,
    private readonly basePropertyRepo: BasePropertyRepo,
    private readonly baseTemplateRepo: BaseTemplateRepo,
    private readonly pageRepo: PageRepo,
    private readonly pageService: PageService,
    private readonly relationService: BaseRelationService,
    private readonly formulaService: BaseFormulaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private primaryOf(properties: BaseProperty[]): BaseProperty | undefined {
    return properties.find((p) => p.isPrimary) ?? properties[0];
  }

  private primaryText(
    properties: BaseProperty[],
    row: BaseRow,
  ): string | undefined {
    const primary = this.primaryOf(properties);
    const value = primary
      ? ((row.cells as any)?.[primary.id] ?? undefined)
      : undefined;
    return typeof value === 'string' ? value : undefined;
  }

  // Rows are backed by a document page, lazy-created on first open. The
  // page hangs under the base page (hidden from the sidebar tree) and its
  // title mirrors the row's primary cell.
  async ensureRowPage(
    basePage: Page,
    rowId: string,
    user: User,
  ): Promise<Page> {
    const row = await this.info(basePage, rowId);
    if (row.rowPageId) {
      const existing = await this.pageRepo.findById(row.rowPageId);
      if (existing && !existing.deletedAt) return existing;
    }
    const properties = await this.basePropertyRepo.findLiveByPageId(
      basePage.id,
    );
    const rowPage = await this.pageService.create(
      user.id,
      basePage.workspaceId,
      {
        title: this.primaryText(properties, row),
        parentPageId: basePage.id,
        spaceId: basePage.spaceId,
      } as any,
    );
    await this.baseRowRepo.setRowPageId(row.id, rowPage.id);
    return rowPage;
  }

  // Reverse lookup for the page route: is this page a row's document?
  async resolveByPage(
    pageId: string,
  ): Promise<{ row: ReturnType<typeof serializeRow> | null; basePageId?: string }> {
    const row = await this.baseRowRepo.findByRowPageId(pageId);
    if (!row) return { row: null };
    return { row: serializeRow(row), basePageId: row.pageId };
  }

  // Emitted by PageService.update when any page title changes; mirrors the
  // new title into the backing row's primary cell.
  @OnEvent('base.row-page.title-updated')
  async onRowPageTitleUpdated(payload: {
    pageId: string;
    title: string | null;
  }): Promise<void> {
    try {
      const row = await this.baseRowRepo.findByRowPageId(payload.pageId);
      if (!row) return;
      const properties = await this.basePropertyRepo.findLiveByPageId(
        row.pageId,
      );
      const primary = this.primaryOf(properties);
      if (!primary) return;
      const current = (row.cells as any)?.[primary.id] ?? null;
      const next = payload.title || null;
      if (current === next) return;
      await this.baseRowRepo.setCellValue(row.id, primary.id, next);
      this.eventEmitter.emit(EventName.BASE_ROW_UPDATED, {
        operation: 'base:row:updated',
        pageId: row.pageId,
        rowId: row.id,
        updatedCells: { [primary.id]: next },
      });
    } catch (err) {
      this.logger.warn(
        `row-page title sync failed: ${(err as any)?.message}`,
      );
    }
  }

  private propertyMap(properties: BaseProperty[]): Map<string, BaseProperty> {
    return new Map(properties.map((p) => [p.id, p]));
  }

  async list(
    page: Page,
    dto: {
      limit?: number;
      cursor?: string;
      filter?: FilterNode;
      sorts?: ViewSortConfig[];
    },
  ): Promise<ListRowsResult & { references: ForkRowReferences }> {
    const properties = await this.basePropertyRepo.findLiveByPageId(page.id);
    const result = await this.baseRowRepo.listRows(page.id, {
      limit: dto.limit ?? 100,
      cursor: dto.cursor,
      filter: dto.filter,
      sorts: dto.sorts,
      properties: this.propertyMap(properties),
    });
    const references = await this.buildReferences(properties, result.items);
    return { ...result, references };
  }

  async info(
    page: Page,
    rowId: string,
  ): Promise<BaseRow> {
    const row = await this.baseRowRepo.findById(rowId);
    if (!row || row.deletedAt || row.pageId !== page.id) {
      throw new NotFoundException('row not found');
    }
    return row;
  }

  async create(
    page: Page,
    dto: {
      cells?: Record<string, unknown>;
      afterRowId?: string;
      position?: string;
      templateId?: string;
      requestId?: string;
    },
    userId: string,
  ): Promise<BaseRow> {
    const properties = await this.basePropertyRepo.findLiveByPageId(page.id);
    const propertyMap = this.propertyMap(properties);

    // Template preset first, explicit cells override (kanban column value
    // must win over the template's group cell).
    let cells: Record<string, unknown> = {};
    if (dto.templateId) {
      const template = await this.baseTemplateRepo.findById(dto.templateId);
      if (!template || template.pageId !== page.id) {
        throw new NotFoundException('template not found');
      }
      cells = { ...((template.cells ?? {}) as Record<string, unknown>) };
    }
    cells = { ...cells, ...(dto.cells ?? {}) };

    const normalized = await this.normalizeCellPatch(propertyMap, cells, {
      forbidNullClears: true,
    });

    let position = dto.position;
    if (!position && dto.afterRowId) {
      const anchor = await this.baseRowRepo.positionAfter(
        page.id,
        dto.afterRowId,
      );
      if (anchor) {
        position = generateJitteredKeyBetween(anchor.position, anchor.next);
      }
    }
    if (!position) {
      const last = await this.baseRowRepo.lastPosition(page.id);
      position = generateJitteredKeyBetween(last, null);
    }

    const row = await this.baseRowRepo.insert({
      pageId: page.id,
      cells: normalized as any,
      position,
      creatorId: userId,
      lastUpdatedById: userId,
      workspaceId: page.workspaceId,
    });

    await this.mirrorRelations(propertyMap, row.id, {}, normalized);
    const withFormulas = await this.applyFormulas(
      page.id,
      row,
      properties,
      Object.keys(normalized),
    );

    this.eventEmitter.emit(EventName.BASE_ROW_CREATED, {
      operation: 'base:row:created',
      pageId: page.id,
      row: serializeRow(withFormulas),
      requestId: dto.requestId,
    });
    return withFormulas;
  }

  async update(
    page: Page,
    dto: {
      rowId: string;
      cells: Record<string, unknown>;
      position?: string;
      requestId?: string;
    },
    userId: string,
  ): Promise<BaseRow> {
    const row = await this.info(page, dto.rowId);
    const properties = await this.basePropertyRepo.findLiveByPageId(page.id);
    const propertyMap = this.propertyMap(properties);
    const normalized = await this.normalizeCellPatch(
      propertyMap,
      dto.cells ?? {},
      {},
    );

    await this.mirrorRelations(
      propertyMap,
      row.id,
      (row.cells ?? {}) as Record<string, unknown>,
      normalized,
    );

    let updated = row;
    if (Object.keys(normalized).length > 0) {
      updated = await this.baseRowRepo.patchCells(row.id, normalized, userId);
    }
    if (dto.position) {
      await this.baseRowRepo.updatePosition(row.id, dto.position, userId);
      updated = { ...updated, position: dto.position };
    }

    updated = await this.applyFormulas(
      page.id,
      updated,
      properties,
      Object.keys(normalized),
    );

    // Grid -> page title mirror when the primary cell changed.
    const primary = this.primaryOf(properties);
    if (
      primary &&
      updated.rowPageId &&
      Object.prototype.hasOwnProperty.call(normalized, primary.id)
    ) {
      const title = normalized[primary.id];
      await this.db
        .updateTable('pages')
        .set({
          title: typeof title === 'string' ? title : null,
          updatedAt: new Date(),
        })
        .where('id', '=', updated.rowPageId)
        .execute();
    }

    this.eventEmitter.emit(EventName.BASE_ROW_UPDATED, {
      operation: 'base:row:updated',
      pageId: page.id,
      rowId: row.id,
      updatedCells: this.pickUpdatedCells(updated, normalized, properties),
      requestId: dto.requestId,
    });
    return updated;
  }

  async delete(
    page: Page,
    dto: { rowIds: string[]; requestId?: string },
    userId?: string,
  ): Promise<void> {
    const rows = await this.baseRowRepo.findLiveByIds(page.id, dto.rowIds);
    if (rows.length === 0) return;
    const properties = await this.basePropertyRepo.findLiveByPageId(page.id);
    const propertyMap = this.propertyMap(properties);

    // Unlink relation pairs so reverse cells don't keep dead row ids.
    for (const row of rows) {
      await this.mirrorRelations(
        propertyMap,
        row.id,
        (row.cells ?? {}) as Record<string, unknown>,
        this.emptyRelationPatch(properties),
      );
    }
    await this.baseRowRepo.softDelete(
      page.id,
      rows.map((r) => r.id),
    );

    // Backing pages follow their rows into the trash.
    for (const row of rows) {
      if (!row.rowPageId) continue;
      try {
        await this.pageRepo.removePage(
          row.rowPageId,
          userId ?? row.lastUpdatedById ?? row.creatorId,
          page.workspaceId,
        );
      } catch (err) {
        this.logger.warn(
          `failed to trash row page ${row.rowPageId}: ${(err as any)?.message}`,
        );
      }
    }

    if (rows.length === 1) {
      this.eventEmitter.emit(EventName.BASE_ROW_DELETED, {
        operation: 'base:row:deleted',
        pageId: page.id,
        rowId: rows[0].id,
        requestId: dto.requestId,
      });
    } else {
      this.eventEmitter.emit(EventName.BASE_ROWS_DELETED, {
        operation: 'base:rows:deleted',
        pageId: page.id,
        rowIds: rows.map((r) => r.id),
        requestId: dto.requestId,
      });
    }
  }

  async reorder(
    page: Page,
    dto: { rowId: string; position: string; requestId?: string },
    userId: string,
  ): Promise<void> {
    await this.info(page, dto.rowId);
    await this.baseRowRepo.updatePosition(dto.rowId, dto.position, userId);
    this.eventEmitter.emit(EventName.BASE_ROW_REORDERED, {
      operation: 'base:row:reordered',
      pageId: page.id,
      rowId: dto.rowId,
      position: dto.position,
      requestId: dto.requestId,
    });
  }

  private emptyRelationPatch(
    properties: BaseProperty[],
  ): Record<string, unknown> {
    const patch: Record<string, unknown> = {};
    for (const property of properties) {
      if (property.type === 'relation') patch[property.id] = null;
    }
    return patch;
  }

  private async normalizeCellPatch(
    propertyMap: Map<string, BaseProperty>,
    cells: Record<string, unknown>,
    opts: { forbidNullClears?: boolean },
  ): Promise<Record<string, unknown>> {
    const normalized: Record<string, unknown> = {};
    for (const [propertyId, raw] of Object.entries(cells)) {
      const property = propertyMap.get(propertyId);
      if (!property) {
        throw new BadRequestException(`unknown property: ${propertyId}`);
      }
      if (isReadonlyType(property.type)) {
        throw new BadRequestException(
          `${property.type} cells are computed and cannot be written`,
        );
      }
      const value = normalizeCellValue(property, raw);
      if (value === null && opts.forbidNullClears) continue;
      if (property.type === 'relation' && Array.isArray(value)) {
        await this.relationService.assertMembership(property, value);
      }
      normalized[propertyId] = value;
    }
    return normalized;
  }

  private async mirrorRelations(
    propertyMap: Map<string, BaseProperty>,
    rowId: string,
    oldCells: Record<string, unknown>,
    patch: Record<string, unknown>,
  ): Promise<void> {
    for (const [propertyId, value] of Object.entries(patch)) {
      const property = propertyMap.get(propertyId);
      if (!property || property.type !== 'relation') continue;
      const oldIds = readRelationIds(oldCells[propertyId]);
      const newIds = readRelationIds(value);
      const { targetPageId, touchedRowIds } = await this.relationService.mirror(
        property,
        rowId,
        oldIds,
        newIds,
      );
      const relatedPropertyId =
        relationOptionsOf(property)?.relatedPropertyId ?? null;
      for (const targetRowId of touchedRowIds) {
        const target = await this.baseRowRepo.findById(targetRowId);
        if (!target || !relatedPropertyId) continue;
        this.eventEmitter.emit(EventName.BASE_ROW_UPDATED, {
          operation: 'base:row:updated',
          pageId: targetPageId,
          rowId: targetRowId,
          updatedCells: {
            [relatedPropertyId]:
              (target.cells as any)?.[relatedPropertyId] ?? null,
          },
        });
      }
    }
  }

  // Recomputes formulas affected by the changed cells; returns the row
  // with formula cells merged in.
  private async applyFormulas(
    pageId: string,
    row: BaseRow,
    properties: BaseProperty[],
    changedPropertyIds: string[],
  ): Promise<BaseRow> {
    const affected = this.formulaService.affectedBy(
      properties,
      changedPropertyIds,
    );
    if (affected.length === 0) return row;
    const patch = this.formulaService.computeRowPatch(
      row,
      affected,
      properties,
    );
    if (Object.keys(patch).length === 0) return row;
    return (
      (await this.baseRowRepo.patchCells(row.id, patch, row.lastUpdatedById)) ??
      row
    );
  }

  private pickUpdatedCells(
    row: BaseRow,
    normalizedPatch: Record<string, unknown>,
    properties: BaseProperty[],
  ): Record<string, unknown> {
    const cells = (row.cells ?? {}) as Record<string, unknown>;
    const updated: Record<string, unknown> = {};
    for (const key of Object.keys(normalizedPatch)) {
      updated[key] = cells[key] ?? null;
    }
    for (const formula of this.formulaService.affectedBy(
      properties,
      Object.keys(normalizedPatch),
    )) {
      updated[formula.id] = cells[formula.id] ?? null;
    }
    return updated;
  }

  private async buildReferences(
    properties: BaseProperty[],
    rows: BaseRow[],
  ): Promise<ForkRowReferences> {
    const userIds = new Set<string>();
    const pageIds = new Set<string>();
    const relationTargets = new Map<string, Set<string>>(); // targetPageId -> rowIds

    for (const row of rows) {
      if (row.creatorId) userIds.add(row.creatorId);
      if (row.lastUpdatedById) userIds.add(row.lastUpdatedById);
      const cells = (row.cells ?? {}) as Record<string, unknown>;
      for (const property of properties) {
        const value = cells[property.id];
        if (value === undefined || value === null) continue;
        if (property.type === 'person') {
          for (const id of Array.isArray(value) ? value : [value]) {
            if (typeof id === 'string') userIds.add(id);
          }
        } else if (property.type === 'page') {
          for (const id of Array.isArray(value) ? value : [value]) {
            if (typeof id === 'string') pageIds.add(id);
          }
        } else if (property.type === 'relation') {
          const options = relationOptionsOf(property);
          if (!options) continue;
          const bucket =
            relationTargets.get(options.targetPageId) ?? new Set<string>();
          for (const id of readRelationIds(value)) bucket.add(id);
          relationTargets.set(options.targetPageId, bucket);
        }
      }
    }

    const references: ForkRowReferences = { users: {}, pages: {} };

    if (userIds.size > 0) {
      const users = await this.db
        .selectFrom('users')
        .select(['id', 'name', 'avatarUrl'])
        .where('id', 'in', [...userIds])
        .where('deletedAt', 'is', null)
        .execute();
      for (const user of users) {
        references.users[user.id] = {
          id: user.id,
          name: user.name,
          avatarUrl: user.avatarUrl,
        };
      }
    }

    if (pageIds.size > 0) {
      const pages = await this.db
        .selectFrom('pages')
        .innerJoin('spaces', 'spaces.id', 'pages.spaceId')
        .select([
          'pages.id',
          'pages.slugId',
          'pages.title',
          'pages.icon',
          'pages.spaceId',
          'spaces.slug as spaceSlug',
          'spaces.name as spaceName',
        ])
        .where('pages.id', 'in', [...pageIds])
        .where('pages.deletedAt', 'is', null)
        .execute();
      for (const page of pages) {
        references.pages[page.id] = {
          id: page.id,
          slugId: page.slugId,
          title: page.title,
          icon: page.icon,
          spaceId: page.spaceId,
          space: {
            id: page.spaceId,
            slug: (page as any).spaceSlug,
            name: (page as any).spaceName,
          },
        } as ResolvedPage;
      }
    }

    if (relationTargets.size > 0) {
      references.rows = {};
      for (const [targetPageId, ids] of relationTargets) {
        const targetProps =
          await this.basePropertyRepo.findLiveByPageId(targetPageId);
        const primary =
          targetProps.find((p) => p.isPrimary) ?? targetProps[0];
        const targetRows = await this.baseRowRepo.findLiveByIds(
          targetPageId,
          [...ids],
        );
        for (const target of targetRows) {
          const title = primary
            ? ((target.cells as any)?.[primary.id] ?? null)
            : null;
          references.rows[target.id] = {
            id: target.id,
            pageId: targetPageId,
            title: typeof title === 'string' ? title : null,
          };
        }
      }
    }

    return references;
  }
}
