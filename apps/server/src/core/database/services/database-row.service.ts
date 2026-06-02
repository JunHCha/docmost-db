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
import { assertPropertyType } from '../utils/property-config';
import { validateValueForType } from '../utils/property-value';
import { CreateRowDto } from '../dto/create-row.dto';
import { ListRowsDto } from '../dto/list-rows.dto';
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

    const rows = await this.databaseRepo.listRows(database.pageId);
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
    // relation target page membership is not verified here (kept minimal; see
    // #10 Relation type).
    assertPropertyType(property.type);
    const value = validateValueForType(
      property.type,
      dto.value,
      property.config as { options?: any[] },
    );

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
