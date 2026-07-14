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
import { DatabaseTemplateRepo } from '@docmost/db/repos/database/database-template.repo';
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
import {
  assertOpForType,
  assertFilterValueForType,
  TITLE_FILTER_ID,
} from '../utils/filter-ops';
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
    private readonly templateRepo: DatabaseTemplateRepo,
    private readonly pageRepo: PageRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
  ) {}

  async createRow(user: User, workspace: Workspace, dto: CreateRowDto) {
    const database = await this.authorize(
      user,
      dto.databaseId,
      SpaceCaslAction.Edit,
    );

    // Optional row-creation template: presets the new page's body (content)
    // and property values atomically on the server. See conventions.md.
    const template = dto.templateId
      ? await this.resolveTemplate(dto.templateId, database)
      : undefined;

    // A row is a document page parented to the database page (page=row).
    const page = await this.pageService.create(
      user.id,
      workspace.id,
      {
        spaceId: database.spaceId,
        title: dto.title ?? template?.name ?? undefined,
        icon: dto.icon ?? template?.icon ?? undefined,
        parentPageId: database.pageId,
        // PageService parses prosemirror JSON when both content+format are set;
        // template.content is jsonb prosemirror JSON (page.service.ts:125).
        ...(template?.content
          ? { content: template.content as object, format: 'json' as const }
          : {}),
      },
    );

    // Merge preset values for the new row: the template's values take priority,
    // and the filter-derived initialValues (#103) only fill propertyIds the
    // template left untouched. Applied through a single validated path.
    const presets: Record<string, unknown> = {};
    if (dto.initialValues && typeof dto.initialValues === 'object') {
      Object.assign(presets, dto.initialValues);
    }
    const templatePresets = template?.propertyValues;
    if (
      templatePresets &&
      typeof templatePresets === 'object' &&
      !Array.isArray(templatePresets)
    ) {
      Object.assign(presets, templatePresets as Record<string, unknown>);
    }

    if (Object.keys(presets).length > 0) {
      await this.applyPresetValues(page.id, presets, database);
    }

    return page;
  }

  // Load the template and verify it belongs to this database. Edit permission
  // on the database page is already enforced by the caller's authorize().
  private async resolveTemplate(templateId: string, database: Database) {
    const template = await this.templateRepo.findById(templateId);
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    if (template.databaseId !== database.id) {
      throw new BadRequestException(
        'Template does not belong to this database',
      );
    }
    return template;
  }

  // Apply preset property values onto the new row. Each entry is a tagged
  // { type, value } keyed by propertyId — sourced from a template and/or the
  // active view's filters (#103). Defensively skip propertyIds that are not
  // properties of this database, skip values that fail type validation, and —
  // for relations — skip values whose page ids are not live rows of the target
  // database (membership boost over the old template path). A skipped value
  // never fails the whole row.
  private async applyPresetValues(
    pageId: string,
    presets: Record<string, unknown>,
    database: Database,
  ): Promise<void> {
    const properties = await this.propertyRepo.findByDatabaseId(database.id);
    const byId = new Map(properties.map((p) => [p.id, p]));

    for (const [propertyId, raw] of Object.entries(presets)) {
      const property = byId.get(propertyId);
      if (!property) continue;

      let value;
      try {
        assertPropertyType(property.type);
        value = validateValueForType(
          property.type,
          raw,
          property.config as { options?: any[] },
        );
        if (property.type === 'relation') {
          await this.assertRelationMembership(
            value.value as string[],
            property.config as { targetDatabaseId?: string },
            database.workspaceId,
          );
        }
      } catch {
        // Malformed/incompatible/foreign preset — skip rather than fail the row.
        continue;
      }

      await this.valueRepo.setValue({
        pageId,
        propertyId,
        value: value as any,
      });
    }
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

    // Validate every page id is a live row of this database up front, so an
    // invalid batch is rejected before any deletion happens.
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

    // Sequential soft-delete (trash) via the existing page path. NOTE: this is
    // NOT atomic — removePage opens its own transaction per call and does not
    // accept an injected trx, so wrapping the whole batch in one transaction
    // would require refactoring PageService/PageRepo (incl. its recursive
    // descendant query and PAGE_SOFT_DELETED event emission). After the up-front
    // validation above a mid-loop failure is unlikely, but if one occurs the
    // batch can be partially deleted; the client mutation's onError invalidates
    // the rows query to resync. See conventions.md.
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
      // The Title pseudo-column is not a property: validate it as text and let
      // the repo compare against pages.title (TITLE_FILTER_ID).
      if (f.propertyId === TITLE_FILTER_ID) {
        assertOpForType('text', f.op);
        const value = assertFilterValueForType('text', f.op, f.value);
        return {
          propertyId: TITLE_FILTER_ID,
          propertyType: 'text',
          op: f.op,
          value,
        };
      }
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
      // The Title pseudo-column sorts on pages.title as text (TITLE_FILTER_ID).
      if (s.propertyId === TITLE_FILTER_ID) {
        return {
          propertyId: TITLE_FILTER_ID,
          propertyType: 'text',
          direction: s.direction,
        };
      }
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

      // Mirror BEFORE writing the source value: mirrorRelation reads the
      // source row's PREVIOUS link set to diff against newIds. Writing the
      // source first would make old === new, so nothing would mirror.
      // Symmetric with clearValue, which also mirrors before clearing.
      await this.mirrorRelation(
        dto.pageId,
        property,
        value.value as string[],
      );
      return this.valueRepo.setValue({
        pageId: dto.pageId,
        propertyId: dto.propertyId,
        value: value as any,
      });
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

    if (property.type === 'relation') {
      // Clearing == setting the link to []: drop the source row from every
      // previously linked target row's reverse value, then clear the source.
      await this.mirrorRelation(dto.pageId, property, []);
    }

    await this.valueRepo.clearValue(dto.pageId, dto.propertyId);
  }

  // Keep the paired reverse relation in sync after the source value changes.
  // `newIds` is the source row's new link set ([] for clear). We diff against
  // the source's previous value and add/remove the source pageId on each
  // affected target row's reverse value (config.relatedPropertyId).
  //
  // NOT atomic: the value repo accepts a trx but this runs sequentially per
  // target row, matching the repo's non-atomic convention (Phase B does the
  // same for column pairing). A mid-loop failure can leave a half-mirrored
  // link; the client's onError invalidates the rows query to resync. We never
  // call back into setValue/clearValue (no recursion) — only direct repo
  // writes — so there is no mirror-of-a-mirror loop. See conventions.md.
  private async mirrorRelation(
    sourcePageId: string,
    property: { id: string; config: unknown },
    newIds: string[],
  ): Promise<void> {
    const relatedPropertyId = (property.config as { relatedPropertyId?: string })
      ?.relatedPropertyId;
    // Legacy/one-way relation: no paired column to mirror into.
    if (!relatedPropertyId) return;

    const oldIds = await this.readRelationIds(sourcePageId, property.id);
    const added = newIds.filter((id) => !oldIds.includes(id));
    const removed = oldIds.filter((id) => !newIds.includes(id));

    for (const targetId of added) {
      const reverse = await this.readRelationIds(targetId, relatedPropertyId);
      if (reverse.includes(sourcePageId)) continue;
      await this.valueRepo.setValue({
        pageId: targetId,
        propertyId: relatedPropertyId,
        value: { type: 'relation', value: [...reverse, sourcePageId] } as any,
      });
    }

    for (const targetId of removed) {
      const reverse = await this.readRelationIds(targetId, relatedPropertyId);
      const next = reverse.filter((id) => id !== sourcePageId);
      if (next.length === 0) {
        await this.valueRepo.clearValue(targetId, relatedPropertyId);
      } else {
        await this.valueRepo.setValue({
          pageId: targetId,
          propertyId: relatedPropertyId,
          value: { type: 'relation', value: next } as any,
        });
      }
    }
  }

  // Read a single relation value's page-id array for (pageId, propertyId),
  // returning [] when absent or not a relation value.
  private async readRelationIds(
    pageId: string,
    propertyId: string,
  ): Promise<string[]> {
    const values = await this.valueRepo.findByPageId(pageId);
    const row = values.find((v) => v.propertyId === propertyId);
    const value = row?.value as { type?: string; value?: unknown } | undefined;
    if (!value || value.type !== 'relation' || !Array.isArray(value.value)) {
      return [];
    }
    return value.value as string[];
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
