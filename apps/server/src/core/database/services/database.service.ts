import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { PageService } from '../../page/services/page.service';
import { DatabaseRepo } from '@docmost/db/repos/database/database.repo';
import { DatabasePropertyRepo } from '@docmost/db/repos/database/database-property.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PropertyType } from '../utils/property-config';
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
    private readonly propertyRepo: DatabasePropertyRepo,
    private readonly pageRepo: PageRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
  ) {}

  // Default columns seeded on every new database. These are computed system
  // columns (issue #128): read-only, values derived from each row page's
  // metadata. Korean names follow the same data-stored convention as relation
  // columns ("<title>와 관계됨").
  private static readonly SYSTEM_COLUMNS: {
    name: string;
    type: PropertyType;
  }[] = [
    { name: '생성자', type: 'created_by' },
    { name: '만든 날짜', type: 'created_time' },
    { name: '수정한 날짜', type: 'last_edited_time' },
  ];

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
      undefined,
      false,
      'database',
    );

    try {
      const database = await this.databaseRepo.insertDatabase({
        pageId: page.id,
        spaceId: dto.spaceId,
        workspaceId: workspace.id,
      });
      await this.seedSystemColumns(database.id);
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

  // Best-effort seed of the computed system columns. A failure here must not
  // fail the whole database creation (the database + page already exist), so it
  // is logged and swallowed — the columns can be re-added manually if needed.
  private async seedSystemColumns(databaseId: string): Promise<void> {
    try {
      let prev: string | null = null;
      for (const col of DatabaseService.SYSTEM_COLUMNS) {
        const position = generateJitteredKeyBetween(prev, null);
        await this.propertyRepo.insertProperty({
          databaseId,
          name: col.name,
          type: col.type,
          config: {},
          position,
        });
        prev = position;
      }
    } catch (err) {
      this.logger.warn(
        `Failed to seed system columns for database ${databaseId}`,
        err,
      );
    }
  }

  async info(user: User, dto: DatabaseInfoDto) {
    // The database can be addressed either directly (databaseId) or through
    // its page (pageId); the DTO guarantees exactly one is present. Only the
    // lookup branches — permission, page resolution and the response are shared.
    const database = dto.pageId
      ? await this.databaseRepo.findByPageId(dto.pageId)
      : await this.databaseRepo.findById(dto.databaseId);
    if (!database) {
      // A page can be addressed here that simply isn't a database (any plain
      // nested document). Instead of a 404 — which is noise the client has to
      // swallow on every doc — answer 200 with database: null. The page is
      // still resolved when addressed by pageId so callers can react.
      const page = dto.pageId
        ? ((await this.pageRepo.findById(dto.pageId)) ?? null)
        : null;
      return { database: null, page };
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
