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

@Injectable()
export class DatabaseViewService {
  constructor(
    private readonly viewRepo: DatabaseViewRepo,
    private readonly databaseRepo: DatabaseRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async create(user: User, dto: CreateViewDto): Promise<DatabaseView> {
    await this.authorize(user, dto.databaseId, SpaceCaslAction.Edit);
    const siblings = await this.viewRepo.findByDatabaseId(dto.databaseId);
    const last = siblings[siblings.length - 1];
    const position = generateJitteredKeyBetween(last?.position ?? null, null);

    return this.viewRepo.insertView({
      databaseId: dto.databaseId,
      name: dto.name,
      type: dto.type ?? 'grid',
      config: (dto.config ?? {}) as Record<string, any>,
      position,
      isDefault: siblings.length === 0,
    });
  }

  async update(user: User, dto: UpdateViewDto): Promise<DatabaseView> {
    const { view } = await this.getViewDatabase(
      user,
      dto.viewId,
      SpaceCaslAction.Edit,
    );
    const patch: Record<string, any> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.config !== undefined) patch.config = dto.config;
    await this.viewRepo.updateView(patch, view.id);
    return this.viewRepo.findById(view.id);
  }

  async setDefault(user: User, dto: ViewIdDto): Promise<void> {
    const { view } = await this.getViewDatabase(
      user,
      dto.viewId,
      SpaceCaslAction.Edit,
    );
    await this.runInTransaction(async (trx) => {
      await this.viewRepo.clearDefaultViews(view.databaseId, trx);
      await this.viewRepo.updateView({ isDefault: true }, view.id, trx);
    });
  }

  async delete(user: User, dto: ViewIdDto): Promise<void> {
    const { view } = await this.getViewDatabase(
      user,
      dto.viewId,
      SpaceCaslAction.Edit,
    );
    const views = await this.viewRepo.findByDatabaseId(view.databaseId);
    if (views.length <= 1) {
      throw new BadRequestException('A database must keep at least one view');
    }
    await this.runInTransaction(async (trx) => {
      if (view.isDefault) {
        const next = views.find((v) => v.id !== view.id);
        if (next) {
          await this.viewRepo.updateView({ isDefault: true }, next.id, trx);
        }
      }
      await this.viewRepo.deleteView(view.id, trx);
    });
  }

  async list(user: User, dto: ListViewsDto): Promise<DatabaseView[]> {
    await this.authorize(user, dto.databaseId, SpaceCaslAction.Read);
    const views = await this.viewRepo.findByDatabaseId(dto.databaseId);
    if (views.length > 0) return views;
    // Lazily create the first view. Two concurrent first-loads (e.g. the grid
    // container and a relation picker on the same database) can both see zero
    // views and try to insert; the partial-unique default index then makes the
    // loser throw 23505. Swallow that and re-read so both callers converge on
    // the view the winner created.
    try {
      const created = await this.viewRepo.insertView({
        databaseId: dto.databaseId,
        name: 'Grid',
        type: 'grid',
        config: {},
        position: generateJitteredKeyBetween(null, null),
        isDefault: true,
      });
      return [created];
    } catch (err) {
      if ((err as { code?: string })?.code !== '23505') throw err;
      return this.viewRepo.findByDatabaseId(dto.databaseId);
    }
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

  private async getViewDatabase(
    user: User,
    viewId: string,
    action: SpaceCaslAction,
  ): Promise<{ view: DatabaseView; database: Database }> {
    const view = await this.viewRepo.findById(viewId);
    if (!view) {
      throw new NotFoundException('View not found');
    }
    const database = await this.authorize(user, view.databaseId, action);
    return { view, database };
  }
}
