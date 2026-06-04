import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PageService } from '../../page/services/page.service';
import { DatabaseRepo } from '@docmost/db/repos/database/database.repo';
import { DatabasePropertyRepo } from '@docmost/db/repos/database/database-property.repo';
import { DatabasePropertyValueRepo } from '@docmost/db/repos/database/database-property-value.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import SpaceAbilityFactory from '../../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../casl/interfaces/space-ability.type';
import { Database, User, Workspace } from '@docmost/db/types/entity.types';
import {
  ListRowsOptions,
  RowFilter,
  RowSort,
} from '@docmost/db/repos/database/database.repo';
import { assertPropertyType } from '../utils/property-config';
import { assertOpForType, assertFilterValueForType } from '../utils/filter-ops';
import { validateValueForType } from '../utils/property-value';
import { CreateRowDto } from '../dto/create-row.dto';
import { ListRowsDto } from '../dto/list-rows.dto';
import { DeleteRowsDto } from '../dto/delete-rows.dto';
import { SetValueDto } from '../dto/set-value.dto';
import { ClearValueDto } from '../dto/clear-value.dto';

@Injectable()
export class DatabaseRowService {
  constructor(
    private readonly pageService: PageService,
    private readonly databaseRepo: DatabaseRepo,
    private readonly propertyRepo: DatabasePropertyRepo,
    private readonly valueRepo: DatabasePropertyValueRepo,
    private readonly pageRepo: PageRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
  ) {}

  async createRow(user: User, workspace: Workspace, dto: CreateRowDto) {
    const database = await this.authorize(
      user,
      dto.databaseId,
      SpaceCaslAction.Edit,
    );

    // A row is a document page parented to the database page (page=row).
    return this.pageService.create(
      user.id,
      workspace.id,
      {
        spaceId: database.spaceId,
        title: dto.title,
        icon: dto.icon,
        parentPageId: database.pageId,
      },
      'doc',
    );
  }

  async listRows(user: User, dto: ListRowsDto) {
    const database = await this.authorize(
      user,
      dto.databaseId,
      SpaceCaslAction.Read,
    );

    const options = await this.resolveListOptions(database, dto);
    const rows = await this.databaseRepo.listRows(database.pageId, options);
    const values = await this.valueRepo.findByPageIds(rows.map((r) => r.id));

    const valuesByPage = new Map<string, typeof values>();
    for (const value of values) {
      const list = valuesByPage.get(value.pageId) ?? [];
      list.push(value);
      valuesByPage.set(value.pageId, list);
    }

    return rows.map((row) => ({
      row,
      values: valuesByPage.get(row.id) ?? [],
    }));
  }

  async deleteRows(user: User, workspace: Workspace, dto: DeleteRowsDto) {
    const database = await this.authorize(
      user,
      dto.databaseId,
      SpaceCaslAction.Edit,
    );

    // Validate every page id is a live row of this database first, so a single
    // bad id rejects the whole batch (no partial deletes).
    const pages = await Promise.all(
      dto.pageIds.map((id) => this.pageRepo.findById(id)),
    );
    pages.forEach((page) => {
      if (
        !page ||
        page.deletedAt ||
        page.parentPageId !== database.pageId
      ) {
        throw new BadRequestException('Row does not belong to this database');
      }
    });

    // Soft-delete (trash) each row via the existing page path.
    for (const pageId of dto.pageIds) {
      await this.pageService.removePage(pageId, user.id, workspace.id);
    }

    return { deleted: dto.pageIds.length };
  }

  // Validate filters/sorts against this database's properties and the op
  // whitelist, then map to repo-level options (resolving property types).
  private async resolveListOptions(
    database: Database,
    dto: ListRowsDto,
  ): Promise<ListRowsOptions> {
    const filters = dto.filters ?? [];
    const sorts = dto.sorts ?? [];
    if (filters.length === 0 && sorts.length === 0) return {};

    const properties = await this.propertyRepo.findByDatabaseId(database.id);
    const typeById = new Map(properties.map((p) => [p.id, p.type]));

    const resolvedFilters: RowFilter[] = filters.map((f) => {
      const type = typeById.get(f.propertyId);
      if (!type) {
        throw new BadRequestException(
          'Filter references a property not in this database',
        );
      }
      assertPropertyType(type);
      assertOpForType(type, f.op);
      // Validate/normalize the raw filter value per type (e.g. reject a
      // non-numeric value on a number property → 400 instead of a Postgres
      // ::numeric runtime error → 500). is_empty/is_not_empty take no value.
      const value = assertFilterValueForType(type, f.op, f.value);
      return {
        propertyId: f.propertyId,
        propertyType: type,
        op: f.op,
        value,
      };
    });

    const resolvedSorts: RowSort[] = sorts.map((s) => {
      const type = typeById.get(s.propertyId);
      if (!type) {
        throw new BadRequestException(
          'Sort references a property not in this database',
        );
      }
      assertPropertyType(type);
      return {
        propertyId: s.propertyId,
        propertyType: type,
        direction: s.direction,
      };
    });

    return { filters: resolvedFilters, sorts: resolvedSorts };
  }

  async setValue(user: User, dto: SetValueDto) {
    const property = await this.propertyRepo.findById(dto.propertyId);
    if (!property) {
      throw new NotFoundException('Property not found');
    }
    const database = await this.authorize(
      user,
      property.databaseId,
      SpaceCaslAction.Edit,
    );
    await this.assertRowInDatabase(dto.pageId, database);

    // Empty values are expressed by clearValue (no row), not setValue(null).
    assertPropertyType(property.type);
    const value = validateValueForType(
      property.type,
      dto.value,
      property.config as { options?: any[] },
    );

    if (property.type === 'relation') {
      await this.assertRelationMembership(
        value.value as string[],
        property.config as { targetDatabaseId?: string },
        database.workspaceId,
      );
    }

    return this.valueRepo.setValue({
      pageId: dto.pageId,
      propertyId: dto.propertyId,
      // Stored as a tagged jsonb object ({ type, value }); see conventions.md §1.
      value: value as any,
    });
  }

  async clearValue(user: User, dto: ClearValueDto) {
    const property = await this.propertyRepo.findById(dto.propertyId);
    if (!property) {
      throw new NotFoundException('Property not found');
    }
    const database = await this.authorize(
      user,
      property.databaseId,
      SpaceCaslAction.Edit,
    );
    // Symmetric with setValue: only clear values on a live row of this database.
    await this.assertRowInDatabase(dto.pageId, database);
    await this.valueRepo.clearValue(dto.pageId, dto.propertyId);
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

  // Ensure every referenced page id is a live row of the relation's target
  // database. Empty arrays are allowed (clear-equivalent). See conventions §1.
  private async assertRelationMembership(
    pageIds: string[],
    config: { targetDatabaseId?: string },
    workspaceId: string,
  ): Promise<void> {
    if (pageIds.length === 0) return;

    const targetDatabase = await this.databaseRepo.findById(
      config.targetDatabaseId as string,
    );
    if (!targetDatabase) {
      throw new BadRequestException('Relation target database not found');
    }

    const pages = await this.pageRepo.findManyByIds(pageIds, { workspaceId });
    const byId = new Map(pages.map((p) => [p.id, p]));
    for (const id of pageIds) {
      const page = byId.get(id);
      if (!page || page.parentPageId !== targetDatabase.pageId) {
        throw new BadRequestException(
          'Relation value references a page that is not a row of the target database',
        );
      }
    }
  }

  // Ensure the target page is actually a live row of this database, so values
  // cannot be written onto arbitrary pages.
  private async assertRowInDatabase(
    pageId: string,
    database: Database,
  ): Promise<void> {
    const page = await this.pageRepo.findById(pageId);
    if (!page || page.deletedAt || page.parentPageId !== database.pageId) {
      throw new BadRequestException('Row does not belong to this database');
    }
  }
}
