import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PageService } from '../../page/services/page.service';
import { DatabaseRepo } from '@docmost/db/repos/database/database.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import SpaceAbilityFactory from '../../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../casl/interfaces/space-ability.type';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { CreateDatabaseDto } from '../dto/create-database.dto';
import { DatabaseInfoDto } from '../dto/database-info.dto';
import { ListDatabasesDto } from '../dto/list-databases.dto';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    private readonly pageService: PageService,
    private readonly databaseRepo: DatabaseRepo,
    private readonly pageRepo: PageRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
  ) {}

  async create(user: User, workspace: Workspace, dto: CreateDatabaseDto) {
    const ability = await this.spaceAbility.createForUser(user, dto.spaceId);
    if (ability.cannot(SpaceCaslAction.Create, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    // Reuse the existing page creation path; the database is a page (page=row).
    const page = await this.pageService.create(
      user.id,
      workspace.id,
      {
        spaceId: dto.spaceId,
        title: dto.title,
        icon: dto.icon,
        parentPageId: dto.parentPageId,
      },
      'database',
    );

    try {
      const database = await this.databaseRepo.insertDatabase({
        pageId: page.id,
        spaceId: dto.spaceId,
        workspaceId: workspace.id,
      });
      return { database, page };
    } catch (err) {
      // Compensation, not a true transaction: the page was created via the
      // existing page path (which also enqueues a watcher job), so this is not
      // fully atomic. insertDatabase failing on a brand-new page is highly
      // unlikely (no unique conflicts possible). Hard-delete the just-created
      // page so a database-typed page is never left without its meta row.
      try {
        await this.pageRepo.deletePage(page.id);
      } catch (cleanupErr) {
        this.logger.error(
          `Failed to roll back page ${page.id} after database meta insert failed`,
          cleanupErr,
        );
      }
      throw err;
    }
  }

  async info(user: User, dto: DatabaseInfoDto) {
    const database = await this.databaseRepo.findById(dto.databaseId);
    if (!database) {
      throw new NotFoundException('Database not found');
    }

    const ability = await this.spaceAbility.createForUser(
      user,
      database.spaceId,
    );
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    const page = await this.pageRepo.findById(database.pageId);
    if (!page || page.deletedAt) {
      // The database page was trashed (soft-deleted). Keep `info` consistent
      // with `list`, which only surfaces databases whose page is alive.
      throw new NotFoundException('Database not found');
    }
    return { database, page };
  }

  async list(user: User, dto: ListDatabasesDto) {
    const ability = await this.spaceAbility.createForUser(user, dto.spaceId);
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    return this.databaseRepo.findBySpaceId(dto.spaceId);
  }
}
