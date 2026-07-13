import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import {
  BaseProperty,
  Page,
  User,
  Workspace,
} from '@docmost/db/types/entity.types';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { BasePropertyRepo } from '@docmost/db/repos/base/base-property.repo';
import { BaseRowRepo } from '@docmost/db/repos/base/base-row.repo';
import { PageService } from '../../page/services/page.service';
import { BaseViewService } from './base-view.service';
import {
  generateBaseChoiceId,
  generateBasePropertyId,
} from '../../../common/helpers/nanoid.utils';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
import { serializeProperty, serializeView } from '../base-events';
import { Choice, ResolvedPage } from '../base.types';

export type BaseInfo = {
  id: string;
  slugId: string;
  name: string;
  icon: string | null;
  pageId: string;
  spaceId: string;
  workspaceId: string;
  creatorId: string | null;
  properties: ReturnType<typeof serializeProperty>[];
  views: ReturnType<typeof serializeView>[];
  createdAt: Date;
  updatedAt: Date;
  permissions?: { canEdit: boolean; hasRestriction: boolean };
  baseSchemaVersion: number;
};

const KANBAN_STATUS_CHOICES: Array<Pick<Choice, 'name' | 'color' | 'category'>> =
  [
    { name: 'To do', color: 'gray', category: 'todo' },
    { name: 'In progress', color: 'blue', category: 'inProgress' },
    { name: 'Done', color: 'green', category: 'complete' },
  ];

@Injectable()
export class BaseService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly pageRepo: PageRepo,
    private readonly pageService: PageService,
    private readonly basePropertyRepo: BasePropertyRepo,
    private readonly baseRowRepo: BaseRowRepo,
    private readonly baseViewService: BaseViewService,
  ) {}

  async findBasePage(pageId: string): Promise<Page> {
    const page = await this.pageRepo.findById(pageId);
    if (!page || page.deletedAt || !page.isBase) {
      throw new NotFoundException('base not found');
    }
    return page;
  }

  async create(
    user: User,
    workspace: Workspace,
    dto: {
      name?: string;
      icon?: string;
      parentPageId?: string;
      spaceId: string;
      template?: 'kanban';
    },
  ): Promise<Page> {
    const page = await this.pageService.create(
      user.id,
      workspace.id,
      {
        title: dto.name,
        icon: dto.icon,
        parentPageId: dto.parentPageId,
        spaceId: dto.spaceId,
      } as any,
      undefined,
      true,
    );
    await this.seedSchema(page, user, dto.template);
    return this.pageRepo.findById(page.id);
  }

  async convert(
    user: User,
    page: Page,
    template?: 'kanban',
  ): Promise<Page> {
    if (page.isBase) return page;
    const properties = await this.basePropertyRepo.findLiveByPageId(page.id);
    await this.db
      .updateTable('pages')
      .set({ isBase: true })
      .where('id', '=', page.id)
      .execute();
    const updated = await this.pageRepo.findById(page.id);
    if (properties.length === 0) {
      await this.seedSchema(updated, user, template);
    }
    return updated;
  }

  // Every base starts with a primary Title property and one empty row
  // (matching the shape the embed-insert skeleton mimics client-side).
  // The default template adds two text columns; the kanban template adds
  // a Status property and a kanban view grouped by it.
  private async seedSchema(
    page: Page,
    user: User,
    template?: 'kanban',
  ): Promise<void> {
    let position = generateJitteredKeyBetween(null, null);
    await this.basePropertyRepo.insert({
      id: generateBasePropertyId(),
      pageId: page.id,
      name: 'Title',
      type: 'text',
      position,
      typeOptions: {} as any,
      isPrimary: true,
      workspaceId: page.workspaceId,
    });

    if (template === 'kanban') {
      const choices: Choice[] = KANBAN_STATUS_CHOICES.map((choice) => ({
        id: generateBaseChoiceId(),
        ...choice,
      }));
      const status = await this.basePropertyRepo.insert({
        id: generateBasePropertyId(),
        pageId: page.id,
        name: 'Status',
        type: 'status',
        position: generateJitteredKeyBetween(position, null),
        typeOptions: {
          choices,
          choiceOrder: choices.map((c) => c.id),
          defaultValue: choices[0].id,
        } as any,
        isPrimary: false,
        workspaceId: page.workspaceId,
      });
      await this.baseViewService.create(page, user, {
        name: 'Kanban',
        type: 'kanban',
        config: { groupByPropertyId: status.id },
      });
    } else {
      for (const name of ['Text 1', 'Text 2']) {
        position = generateJitteredKeyBetween(position, null);
        await this.basePropertyRepo.insert({
          id: generateBasePropertyId(),
          pageId: page.id,
          name,
          type: 'text',
          position,
          typeOptions: {} as any,
          isPrimary: false,
          workspaceId: page.workspaceId,
        });
      }
    }

    await this.baseRowRepo.insert({
      pageId: page.id,
      cells: {} as any,
      position: generateJitteredKeyBetween(null, null),
      creatorId: user.id,
      lastUpdatedById: user.id,
      workspaceId: page.workspaceId,
    });
  }

  async info(
    page: Page,
    user: User,
    permissions: { canEdit: boolean; hasRestriction: boolean },
  ): Promise<BaseInfo> {
    const [properties, views] = await Promise.all([
      this.basePropertyRepo.findLiveByPageId(page.id),
      this.baseViewService.list(page, user, { embedId: null }),
    ]);
    return {
      id: page.id,
      slugId: page.slugId,
      name: page.title ?? '',
      icon: page.icon,
      pageId: page.id,
      spaceId: page.spaceId,
      workspaceId: page.workspaceId,
      creatorId: page.creatorId,
      properties: properties.map(serializeProperty),
      views: views.map(serializeView),
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
      permissions,
      baseSchemaVersion: page.baseSchemaVersion ?? 0,
    };
  }

  async update(
    page: Page,
    dto: { name?: string; icon?: string },
  ): Promise<void> {
    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.title = dto.name;
    if (dto.icon !== undefined) patch.icon = dto.icon;
    if (Object.keys(patch).length === 0) return;
    await this.db
      .updateTable('pages')
      .set({ ...patch, updatedAt: new Date() })
      .where('id', '=', page.id)
      .execute();
  }

  async delete(page: Page, user: User): Promise<void> {
    await this.pageRepo.removePage(page.id, user.id, page.workspaceId);
  }

  async listInSpace(
    spaceId: string,
    pagination: { cursor?: string; limit?: number },
  ) {
    const query = this.db
      .selectFrom('pages')
      .select([
        'id',
        'slugId',
        'title',
        'icon',
        'spaceId',
        'workspaceId',
        'creatorId',
        'createdAt',
        'updatedAt',
      ])
      .where('spaceId', '=', spaceId)
      .where('isBase', '=', true)
      .where('deletedAt', 'is', null);

    const result = await executeWithCursorPagination(query, {
      perPage: Math.min(pagination.limit ?? 50, 100),
      cursor: pagination.cursor,
      fields: [
        { expression: 'updatedAt', direction: 'desc' },
        { expression: 'id', direction: 'desc' },
      ],
      parseCursor: (cursor) => ({
        updatedAt: new Date(cursor.updatedAt),
        id: cursor.id,
      }),
    });
    return {
      items: result.items.map((page) => ({
        ...page,
        name: page.title ?? '',
        pageId: page.id,
      })),
      meta: result.meta,
    };
  }

  // Resolves page ids for `page` cells; inaccessible ids are omitted.
  async expandPages(
    user: User,
    workspace: Workspace,
    pageIds: string[],
  ): Promise<{ items: ResolvedPage[] }> {
    if (pageIds.length === 0) return { items: [] };
    const pages = await this.db
      .selectFrom('pages')
      .innerJoin('spaces', 'spaces.id', 'pages.spaceId')
      .innerJoin('spaceMembers', (join) =>
        join
          .onRef('spaceMembers.spaceId', '=', 'pages.spaceId')
          .on('spaceMembers.userId', '=', user.id),
      )
      .select([
        'pages.id',
        'pages.slugId',
        'pages.title',
        'pages.icon',
        'pages.spaceId',
        'spaces.slug as spaceSlug',
        'spaces.name as spaceName',
      ])
      .where('pages.id', 'in', pageIds.slice(0, 200))
      .where('pages.workspaceId', '=', workspace.id)
      .where('pages.deletedAt', 'is', null)
      .groupBy([
        'pages.id',
        'pages.slugId',
        'pages.title',
        'pages.icon',
        'pages.spaceId',
        'spaces.slug',
        'spaces.name',
      ])
      .execute();
    return {
      items: pages.map((page) => ({
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
      })),
    };
  }

  // CSV export: header = property names in position order, one line per
  // row in position order. Choice cells resolve to names, arrays join.
  async exportCsv(page: Page): Promise<{ filename: string; csv: string }> {
    const [properties, rows] = await Promise.all([
      this.basePropertyRepo.findLiveByPageId(page.id),
      this.baseRowRepo.findAllLive(page.id),
    ]);
    const escape = (value: string) =>
      /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

    const header = properties.map((p) => escape(p.name)).join(',');
    const lines = rows.map((row) => {
      const cells = (row.cells ?? {}) as Record<string, unknown>;
      return properties
        .map((property) =>
          escape(this.cellToText(property, cells[property.id], row)),
        )
        .join(',');
    });
    const name = (page.title || 'base').replace(/[\\/:*?"<>|]/g, '_');
    return {
      filename: `${name}.csv`,
      csv: [header, ...lines].join('\r\n'),
    };
  }

  private cellToText(
    property: BaseProperty,
    value: unknown,
    row: { createdAt: Date; updatedAt: Date; lastUpdatedById: string | null },
  ): string {
    if (property.type === 'createdAt') return row.createdAt.toISOString();
    if (property.type === 'lastEditedAt') return row.updatedAt.toISOString();
    if (property.type === 'lastEditedBy') return row.lastUpdatedById ?? '';
    if (value === null || value === undefined) return '';
    if (property.type === 'select' || property.type === 'status') {
      const choices = ((property.typeOptions as any)?.choices ?? []) as Choice[];
      return choices.find((c) => c.id === value)?.name ?? '';
    }
    if (property.type === 'multiSelect') {
      const choices = ((property.typeOptions as any)?.choices ?? []) as Choice[];
      return (Array.isArray(value) ? value : [])
        .map((id) => choices.find((c) => c.id === id)?.name)
        .filter(Boolean)
        .join(', ');
    }
    if (Array.isArray(value)) return value.map(String).join(', ');
    if (typeof value === 'object') {
      if ('__err' in (value as any)) return '#ERROR';
      return JSON.stringify(value);
    }
    return String(value);
  }
}
