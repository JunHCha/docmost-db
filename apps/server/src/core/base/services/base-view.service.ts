import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { BaseView, Page, User } from '@docmost/db/types/entity.types';
import { BaseViewRepo, ViewScope } from '@docmost/db/repos/base/base-view.repo';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { EventName } from '../../../common/events/event.contants';
import { serializeView } from '../base-events';
import { BASE_VIEW_TYPES, BaseViewType, ViewConfigPatch } from '../base.types';

// Fork feature: 4-quadrant view scoping — (original|embed) x
// (shared|personal). Embed scopes are seeded from the base's shared views
// on first list; orphaned embed views are soft-deleted on document save
// and hard-deleted by OrphanViewCleanupService after a grace period.
@Injectable()
export class BaseViewService {
  private readonly logger = new Logger(BaseViewService.name);

  constructor(
    private readonly baseViewRepo: BaseViewRepo,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(
    page: Page,
    user: User,
    dto: { embedId?: string | null; sourcePageId?: string | null },
  ): Promise<BaseView[]> {
    const scope: ViewScope = { pageId: page.id, embedId: dto.embedId ?? null };
    let views = await this.baseViewRepo.findByScope(scope, user.id);
    if (views.length === 0) {
      await this.seedScope(page, user, scope, dto.sourcePageId ?? null);
      views = await this.baseViewRepo.findByScope(scope, user.id);
    }
    return views;
  }

  // Embed scopes clone the base's shared views; empty bases get a lazy
  // default table view. Concurrent first-loads race on the per-scope
  // default unique index — the loser swallows 23505 and re-reads.
  private async seedScope(
    page: Page,
    user: User,
    scope: ViewScope,
    sourcePageId: string | null,
  ): Promise<void> {
    try {
      if (scope.embedId) {
        const originals = await this.baseViewRepo.findByScope(
          { pageId: page.id, embedId: null },
          user.id,
        );
        const shared = originals.filter((v) => !v.ownerUserId);
        if (shared.length > 0) {
          for (const view of shared) {
            await this.baseViewRepo.insert({
              pageId: page.id,
              name: view.name,
              type: view.type,
              position: view.position,
              config: view.config as any,
              workspaceId: view.workspaceId,
              creatorId: user.id,
              embedId: scope.embedId,
              sourcePageId,
              isDefault: view.isDefault,
            });
          }
          return;
        }
      }
      await this.baseViewRepo.insert({
        pageId: page.id,
        name: 'Table',
        type: 'table',
        position: generateJitteredKeyBetween(null, null),
        config: {} as any,
        workspaceId: page.workspaceId,
        creatorId: user.id,
        embedId: scope.embedId,
        sourcePageId: scope.embedId ? sourcePageId : null,
        isDefault: true,
      });
    } catch (err: any) {
      if (err?.code === '23505' || err?.cause?.code === '23505') {
        this.logger.debug('view seed race lost; re-reading scope');
        return;
      }
      throw err;
    }
  }

  async create(
    page: Page,
    user: User,
    dto: {
      name: string;
      type?: string;
      config?: Record<string, unknown>;
      embedId?: string | null;
      sourcePageId?: string | null;
      visibility?: 'shared' | 'personal';
    },
  ): Promise<BaseView> {
    const type = (dto.type ?? 'table') as BaseViewType;
    if (!BASE_VIEW_TYPES.includes(type)) {
      throw new BadRequestException(`unknown view type: ${dto.type}`);
    }
    const scope: ViewScope = { pageId: page.id, embedId: dto.embedId ?? null };
    const existing = await this.baseViewRepo.findByScope(scope, user.id);
    const last = existing[existing.length - 1];
    const view = await this.baseViewRepo.insert({
      pageId: page.id,
      name: dto.name,
      type,
      position: generateJitteredKeyBetween(last?.position ?? null, null),
      config: (dto.config ?? {}) as any,
      workspaceId: page.workspaceId,
      creatorId: user.id,
      embedId: scope.embedId,
      sourcePageId: scope.embedId ? (dto.sourcePageId ?? null) : null,
      ownerUserId: dto.visibility === 'personal' ? user.id : null,
      isDefault: existing.length === 0,
    });
    this.eventEmitter.emit(EventName.BASE_VIEW_CREATED, {
      operation: 'base:view:created',
      pageId: page.id,
      view: serializeView(view),
    });
    return view;
  }

  private async findOwned(
    page: Page,
    user: User,
    viewId: string,
    canEditShared: boolean,
  ): Promise<BaseView> {
    const view = await this.baseViewRepo.findById(viewId);
    if (!view || view.pageId !== page.id || view.orphanedAt) {
      throw new NotFoundException('view not found');
    }
    if (view.ownerUserId) {
      if (view.ownerUserId !== user.id) {
        throw new ForbiddenException('not your personal view');
      }
    } else if (!canEditShared) {
      throw new ForbiddenException('shared views require edit permission');
    }
    return view;
  }

  // config is a patch: null deletes the key, undefined is ignored,
  // anything else overwrites. Returns the fully-merged view.
  async update(
    page: Page,
    user: User,
    dto: {
      viewId: string;
      name?: string;
      type?: string;
      config?: ViewConfigPatch;
      position?: string;
    },
    canEditShared: boolean,
  ): Promise<BaseView> {
    const view = await this.findOwned(page, user, dto.viewId, canEditShared);
    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.position !== undefined) patch.position = dto.position;
    if (dto.type !== undefined) {
      if (!BASE_VIEW_TYPES.includes(dto.type as BaseViewType)) {
        throw new BadRequestException(`unknown view type: ${dto.type}`);
      }
      patch.type = dto.type;
    }
    if (dto.config !== undefined) {
      const merged: Record<string, unknown> = {
        ...((view.config ?? {}) as Record<string, unknown>),
      };
      for (const [key, value] of Object.entries(dto.config)) {
        if (value === undefined) continue;
        if (value === null) delete merged[key];
        else merged[key] = value;
      }
      patch.config = merged as any;
    }
    const updated = await this.baseViewRepo.update(view.id, patch);
    this.eventEmitter.emit(EventName.BASE_VIEW_UPDATED, {
      operation: 'base:view:updated',
      pageId: page.id,
      view: serializeView(updated),
    });
    return updated;
  }

  async delete(
    page: Page,
    user: User,
    viewId: string,
    canEditShared: boolean,
  ): Promise<void> {
    const view = await this.findOwned(page, user, viewId, canEditShared);
    const scope: ViewScope = { pageId: page.id, embedId: view.embedId };
    const siblings = await this.baseViewRepo.findByScope(scope, user.id);

    // A scope keeps at least one shared view; personal views may go to 0.
    if (!view.ownerUserId) {
      const sharedCount = siblings.filter((v) => !v.ownerUserId).length;
      if (sharedCount <= 1) {
        throw new BadRequestException('a base needs at least one shared view');
      }
    }

    await this.baseViewRepo.delete(view.id);

    if (view.isDefault) {
      const successor = siblings.find(
        (v) => v.id !== view.id && !v.ownerUserId,
      );
      if (successor) {
        await this.baseViewRepo.update(successor.id, { isDefault: true });
      }
    }

    this.eventEmitter.emit(EventName.BASE_VIEW_DELETED, {
      operation: 'base:view:deleted',
      pageId: page.id,
      viewId: view.id,
    });
  }

  async setDefault(
    page: Page,
    user: User,
    viewId: string,
    canEditShared: boolean,
  ): Promise<BaseView> {
    const view = await this.findOwned(page, user, viewId, canEditShared);
    await this.baseViewRepo.clearDefaults(
      { pageId: page.id, embedId: view.embedId },
      view.ownerUserId,
    );
    const updated = await this.baseViewRepo.update(view.id, {
      isDefault: true,
    });
    this.eventEmitter.emit(EventName.BASE_VIEW_UPDATED, {
      operation: 'base:view:updated',
      pageId: page.id,
      view: serializeView(updated),
    });
    return updated;
  }

  // Called on host-document save with the embed ids still present in the
  // document. Views of vanished embeds are orphaned (soft), re-appearing
  // embeds are restored (undo-safe).
  async reconcileEmbedViews(
    sourcePageId: string,
    liveEmbedIds: string[],
  ): Promise<void> {
    await this.baseViewRepo.softDeleteOrphans(sourcePageId, liveEmbedIds);
    await this.baseViewRepo.restoreOrphans(sourcePageId, liveEmbedIds);
  }

  // Emitted by PersistenceExtension on document save (decoupled from the
  // collaboration module via the event bus).
  @OnEvent('base.embeds.reconcile')
  async onEmbedsReconcile(payload: {
    sourcePageId: string;
    embedIds: string[];
  }): Promise<void> {
    try {
      await this.reconcileEmbedViews(payload.sourcePageId, payload.embedIds);
    } catch (err) {
      this.logger.warn(
        `embed view reconcile failed: ${(err as any)?.message}`,
      );
    }
  }
}
