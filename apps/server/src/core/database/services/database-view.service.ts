import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { DatabaseViewRepo } from '@docmost/db/repos/database/database-view.repo';
import { DatabaseRepo } from '@docmost/db/repos/database/database.repo';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { executeTx } from '@docmost/db/utils';
import SpaceAbilityFactory from '../../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../casl/interfaces/space-ability.type';
import { Database, DatabaseView, User } from '@docmost/db/types/entity.types';
import { CreateViewDto } from '../dto/create-view.dto';
import { UpdateViewDto } from '../dto/update-view.dto';
import { ViewIdDto } from '../dto/view-id.dto';
import { ListViewsDto } from '../dto/list-views.dto';
import { collectEmbedIdsFromPmJson } from '../utils/database-embed-prosemirror.util';

@Injectable()
export class DatabaseViewService {
  constructor(
    private readonly viewRepo: DatabaseViewRepo,
    private readonly databaseRepo: DatabaseRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async create(user: User, dto: CreateViewDto): Promise<DatabaseView> {
    const embedId = dto.embedId ?? null;
    const isPersonal = dto.visibility === 'personal';
    // Personal views only need Read (a read-only user owns their own views);
    // shared views mutate everyone's context and need Edit.
    await this.authorize(
      user,
      dto.databaseId,
      isPersonal ? SpaceCaslAction.Read : SpaceCaslAction.Edit,
    );
    const ownerUserId = isPersonal ? user.id : null;

    const siblings = await this.viewRepo.findByScope({
      databaseId: dto.databaseId,
      embedId,
      ownerUserId: user.id,
    });
    const scopeSiblings = siblings.filter(
      (v) => (v.ownerUserId ?? null) === ownerUserId,
    );
    const last = scopeSiblings[scopeSiblings.length - 1];
    const position = generateJitteredKeyBetween(last?.position ?? null, null);

    return this.viewRepo.insertView({
      databaseId: dto.databaseId,
      name: dto.name,
      type: dto.type ?? 'table',
      config: (dto.config ?? {}) as Record<string, any>,
      position,
      isDefault: scopeSiblings.length === 0,
      embedId,
      ownerUserId,
      sourcePageId: embedId ? (dto.pageId ?? null) : null,
    });
  }

  async update(user: User, dto: UpdateViewDto): Promise<DatabaseView> {
    const { view } = await this.getViewForWrite(user, dto.viewId);
    const patch: Record<string, any> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.config !== undefined) patch.config = dto.config;
    await this.viewRepo.updateView(patch, view.id);
    return this.viewRepo.findById(view.id);
  }

  async setDefault(user: User, dto: ViewIdDto): Promise<void> {
    const { view } = await this.getViewForWrite(user, dto.viewId);
    await this.runInTransaction(async (trx) => {
      await this.viewRepo.clearDefaultViews(
        {
          databaseId: view.databaseId,
          embedId: view.embedId ?? null,
          ownerUserId: view.ownerUserId ?? null,
        },
        trx,
      );
      await this.viewRepo.updateView({ isDefault: true }, view.id, trx);
    });
  }

  async delete(user: User, dto: ViewIdDto): Promise<void> {
    const { view } = await this.getViewForWrite(user, dto.viewId);
    const views = await this.viewRepo.findByScope({
      databaseId: view.databaseId,
      embedId: view.embedId ?? null,
      ownerUserId: user.id,
    });
    const scopeViews = views.filter(
      (v) => (v.ownerUserId ?? null) === (view.ownerUserId ?? null),
    );
    // The "keep at least one view" rule only applies to shared views: a #39
    // 4-quadrant scope always retains the shared views, so a personal scope may
    // safely drop to zero. Deleting a shared view that is the last shared one
    // is still blocked.
    const isShared = (view.ownerUserId ?? null) === null;
    if (isShared && scopeViews.length <= 1) {
      throw new BadRequestException('A database must keep at least one view');
    }
    await this.runInTransaction(async (trx) => {
      if (view.isDefault) {
        const next = scopeViews.find((v) => v.id !== view.id);
        if (next) {
          await this.viewRepo.updateView({ isDefault: true }, next.id, trx);
        }
      }
      await this.viewRepo.deleteView(view.id, trx);
    });
  }

  async list(user: User, dto: ListViewsDto): Promise<DatabaseView[]> {
    await this.authorize(user, dto.databaseId, SpaceCaslAction.Read);
    const embedId = dto.embedId ?? null;
    const views = await this.viewRepo.findByScope({
      databaseId: dto.databaseId,
      embedId,
      ownerUserId: user.id,
    });
    if (views.length > 0) return views;

    // Empty scope: an embed scope seeds from the original DB's shared views;
    // the original scope (or an embed whose origin is also empty) lazily gets a
    // default Table view. Concurrent first-loads can both see zero views and
    // insert; the per-scope partial-unique default index makes the loser throw
    // 23505. Swallow it and re-read so callers converge on the winner's views.
    try {
      if (embedId !== null) {
        const originViews = await this.viewRepo.findByScope({
          databaseId: dto.databaseId,
          embedId: null,
          ownerUserId: user.id,
        });
        const originShared = originViews.filter(
          (v) => (v.ownerUserId ?? null) === null,
        );
        if (originShared.length > 0) {
          const seeded: DatabaseView[] = [];
          for (const origin of originShared) {
            seeded.push(
              await this.viewRepo.insertView({
                databaseId: dto.databaseId,
                name: origin.name,
                type: origin.type,
                config: origin.config as Record<string, any>,
                position: origin.position,
                isDefault: origin.isDefault,
                embedId,
                ownerUserId: null,
                sourcePageId: embedId ? (dto.pageId ?? null) : null,
              }),
            );
          }
          return seeded;
        }
      }

      const created = await this.viewRepo.insertView({
        databaseId: dto.databaseId,
        name: 'Table',
        type: 'table',
        config: {},
        position: generateJitteredKeyBetween(null, null),
        isDefault: true,
        embedId,
        ownerUserId: null,
        sourcePageId: embedId ? (dto.pageId ?? null) : null,
      });
      return [created];
    } catch (err) {
      if ((err as { code?: string })?.code !== '23505') throw err;
      return this.viewRepo.findByScope({
        databaseId: dto.databaseId,
        embedId,
        ownerUserId: user.id,
      });
    }
  }

  // Save-time reconcile (system op, no CASL): soft-delete embed views whose
  // node vanished from the page and restore any that re-appeared (undo). The
  // diff is idempotent so the next save converges if a round drops anything.
  async reconcileEmbedViews(pageId: string, pmJson: unknown): Promise<void> {
    const desired = collectEmbedIdsFromPmJson(pmJson);
    await this.runInTransaction(async (trx) => {
      await this.viewRepo.softDeleteOrphans(
        { sourcePageId: pageId, keepEmbedIds: desired },
        trx,
      );
      await this.viewRepo.restoreOrphans(
        { sourcePageId: pageId, embedIds: desired },
        trx,
      );
    });
  }

  // --- helpers ---

  // Wraps a transaction so specs can stub it without injecting a real Kysely db.
  protected runInTransaction<T>(
    cb: (trx: KyselyTransaction) => Promise<T>,
  ): Promise<T> {
    return executeTx(this.db, cb);
  }

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

  // Authorizes a mutating op on a view by its scope: a personal view (owner set)
  // requires the owner to be the caller and only space Read; a shared view (owner
  // NULL) requires space Edit.
  private async getViewForWrite(
    user: User,
    viewId: string,
  ): Promise<{ view: DatabaseView; database: Database }> {
    const view = await this.viewRepo.findById(viewId);
    if (!view) {
      throw new NotFoundException('View not found');
    }
    const isPersonal = (view.ownerUserId ?? null) !== null;
    if (isPersonal && view.ownerUserId !== user.id) {
      throw new ForbiddenException();
    }
    const database = await this.authorize(
      user,
      view.databaseId,
      isPersonal ? SpaceCaslAction.Read : SpaceCaslAction.Edit,
    );
    return { view, database };
  }
}
