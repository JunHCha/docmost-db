// Stub PageService so its heavy transitive imports (prosemirror / @tiptap/pm)
// never load in this unit test. We only need the class as a DI token.
jest.mock('../../page/services/page.service', () => ({
  PageService: class PageService {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseRowService } from './database-row.service';
import { PageService } from '../../page/services/page.service';
import { DatabaseRepo } from '@docmost/db/repos/database/database.repo';
import { DatabasePropertyRepo } from '@docmost/db/repos/database/database-property.repo';
import { DatabasePropertyValueRepo } from '@docmost/db/repos/database/database-property-value.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { DatabaseTemplateRepo } from '@docmost/db/repos/database/database-template.repo';
import SpaceAbilityFactory from '../../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../casl/interfaces/space-ability.type';

const user: any = { id: 'user-1' };
const workspace: any = { id: 'ws-1' };
const database: any = {
  id: 'db-1',
  pageId: 'dbpage-1',
  spaceId: 'space-1',
  workspaceId: 'ws-1',
};

function abilityMock(allowed: boolean) {
  return {
    can: jest.fn().mockReturnValue(allowed),
    cannot: jest.fn().mockReturnValue(!allowed),
  };
}

describe('DatabaseRowService', () => {
  let service: DatabaseRowService;
  let pageService: jest.Mocked<Pick<PageService, 'create' | 'removePage'>>;
  let databaseRepo: jest.Mocked<Pick<DatabaseRepo, 'findById' | 'listRows'>>;
  let propertyRepo: jest.Mocked<
    Pick<DatabasePropertyRepo, 'findById' | 'findByDatabaseId'>
  >;
  let valueRepo: jest.Mocked<
    Pick<DatabasePropertyValueRepo, 'findByPageIds' | 'setValue' | 'clearValue'>
  >;
  let pageRepo: jest.Mocked<Pick<PageRepo, 'findById' | 'findManyByIds'>>;
  let templateRepo: jest.Mocked<Pick<DatabaseTemplateRepo, 'findById'>>;
  let spaceAbility: jest.Mocked<Pick<SpaceAbilityFactory, 'createForUser'>>;

  beforeEach(async () => {
    pageService = { create: jest.fn(), removePage: jest.fn() } as any;
    databaseRepo = {
      findById: jest.fn().mockResolvedValue(database),
      listRows: jest.fn().mockResolvedValue([]),
    } as any;
    propertyRepo = {
      findById: jest.fn(),
      findByDatabaseId: jest.fn().mockResolvedValue([]),
    } as any;
    valueRepo = {
      findByPageIds: jest.fn().mockResolvedValue([]),
      setValue: jest.fn(),
      clearValue: jest.fn(),
    } as any;
    pageRepo = {
      findById: jest.fn(),
      findManyByIds: jest.fn().mockResolvedValue([]),
    } as any;
    templateRepo = { findById: jest.fn() } as any;
    spaceAbility = {
      createForUser: jest.fn().mockResolvedValue(abilityMock(true)),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseRowService,
        { provide: PageService, useValue: pageService },
        { provide: DatabaseRepo, useValue: databaseRepo },
        { provide: DatabasePropertyRepo, useValue: propertyRepo },
        { provide: DatabasePropertyValueRepo, useValue: valueRepo },
        { provide: PageRepo, useValue: pageRepo },
        { provide: DatabaseTemplateRepo, useValue: templateRepo },
        { provide: SpaceAbilityFactory, useValue: spaceAbility },
      ],
    }).compile();

    service = module.get<DatabaseRowService>(DatabaseRowService);
  });

  describe('createRow', () => {
    it('throws Forbidden without edit permission', async () => {
      spaceAbility.createForUser.mockResolvedValue(abilityMock(false) as any);
      await expect(
        service.createRow(user, workspace, { databaseId: 'db-1' } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(pageService.create).not.toHaveBeenCalled();
    });

    it('creates a doc page parented to the database page', async () => {
      const ability = abilityMock(true);
      spaceAbility.createForUser.mockResolvedValue(ability as any);
      const page: any = { id: 'row-1' };
      pageService.create.mockResolvedValue(page);

      const result = await service.createRow(user, workspace, {
        databaseId: 'db-1',
        title: 'Row',
      } as any);

      expect(ability.cannot).toHaveBeenCalledWith(
        SpaceCaslAction.Edit,
        SpaceCaslSubject.Page,
      );
      expect(pageService.create).toHaveBeenCalledWith(
        user.id,
        workspace.id,
        expect.objectContaining({
          spaceId: 'space-1',
          parentPageId: 'dbpage-1',
          title: 'Row',
        }),
        'doc',
      );
      expect(result).toBe(page);
      expect(templateRepo.findById).not.toHaveBeenCalled();
      expect(valueRepo.setValue).not.toHaveBeenCalled();
    });

    describe('with templateId', () => {
      const template: any = {
        id: 'tpl-1',
        databaseId: 'db-1',
        name: 'Bug report',
        icon: '🐛',
        content: { type: 'doc', content: [] },
        propertyValues: {
          'p-status': { type: 'select', value: 'opt-1' },
        },
      };

      beforeEach(() => {
        pageService.create.mockResolvedValue({ id: 'row-1' } as any);
        propertyRepo.findByDatabaseId.mockResolvedValue([
          { id: 'p-status', type: 'select', config: {} },
        ] as any);
      });

      it('seeds template content and applies property values', async () => {
        templateRepo.findById.mockResolvedValue(template);

        await service.createRow(user, workspace, {
          databaseId: 'db-1',
          title: 'Row',
          templateId: 'tpl-1',
        } as any);

        expect(templateRepo.findById).toHaveBeenCalledWith('tpl-1');
        expect(pageService.create).toHaveBeenCalledWith(
          user.id,
          workspace.id,
          expect.objectContaining({
            spaceId: 'space-1',
            parentPageId: 'dbpage-1',
            title: 'Row',
            content: template.content,
            format: 'json',
          }),
          'doc',
        );
        expect(valueRepo.setValue).toHaveBeenCalledWith({
          pageId: 'row-1',
          propertyId: 'p-status',
          value: { type: 'select', value: 'opt-1' },
        });
      });

      it('throws NotFound for a missing template', async () => {
        templateRepo.findById.mockResolvedValue(undefined);
        await expect(
          service.createRow(user, workspace, {
            databaseId: 'db-1',
            templateId: 'tpl-x',
          } as any),
        ).rejects.toBeInstanceOf(NotFoundException);
        expect(pageService.create).not.toHaveBeenCalled();
      });

      it('throws BadRequest for a template of another database', async () => {
        templateRepo.findById.mockResolvedValue({
          ...template,
          databaseId: 'other-db',
        });
        await expect(
          service.createRow(user, workspace, {
            databaseId: 'db-1',
            templateId: 'tpl-1',
          } as any),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(pageService.create).not.toHaveBeenCalled();
      });

      it('skips property values for properties not in this database', async () => {
        templateRepo.findById.mockResolvedValue({
          ...template,
          propertyValues: {
            'p-status': { type: 'select', value: 'opt-1' },
            'p-foreign': { type: 'text', value: 'x' },
          },
        });

        await service.createRow(user, workspace, {
          databaseId: 'db-1',
          templateId: 'tpl-1',
        } as any);

        expect(valueRepo.setValue).toHaveBeenCalledTimes(1);
        expect(valueRepo.setValue).toHaveBeenCalledWith({
          pageId: 'row-1',
          propertyId: 'p-status',
          value: { type: 'select', value: 'opt-1' },
        });
      });

      it('falls back to template name/icon when dto omits them', async () => {
        templateRepo.findById.mockResolvedValue(template);

        await service.createRow(user, workspace, {
          databaseId: 'db-1',
          templateId: 'tpl-1',
        } as any);

        expect(pageService.create).toHaveBeenCalledWith(
          user.id,
          workspace.id,
          expect.objectContaining({
            title: 'Bug report',
            icon: '🐛',
          }),
          'doc',
        );
      });

      it('does not seed content when template content is null', async () => {
        templateRepo.findById.mockResolvedValue({
          ...template,
          content: null,
        });

        await service.createRow(user, workspace, {
          databaseId: 'db-1',
          templateId: 'tpl-1',
        } as any);

        const arg = pageService.create.mock.calls[0][2] as any;
        expect(arg.content).toBeUndefined();
        expect(arg.format).toBeUndefined();
      });

      it('skips an invalid tagged value (type mismatch)', async () => {
        templateRepo.findById.mockResolvedValue({
          ...template,
          propertyValues: {
            'p-status': { type: 'text', value: 'wrong-type' },
          },
        });

        await service.createRow(user, workspace, {
          databaseId: 'db-1',
          templateId: 'tpl-1',
        } as any);

        expect(valueRepo.setValue).not.toHaveBeenCalled();
      });
    });
  });

  describe('listRows', () => {
    it('requires read permission and assembles rows with values', async () => {
      databaseRepo.listRows.mockResolvedValue([
        { id: 'row-1' },
        { id: 'row-2' },
      ] as any);
      valueRepo.findByPageIds.mockResolvedValue([
        { pageId: 'row-1', propertyId: 'p1', value: { type: 'text', value: 'a' } },
      ] as any);

      const result = await service.listRows(user, { databaseId: 'db-1' } as any);

      expect(spaceAbility.createForUser).toHaveBeenCalledWith(user, 'space-1');
      expect(databaseRepo.listRows).toHaveBeenCalledWith('dbpage-1', {});
      expect(result).toEqual([
        {
          row: { id: 'row-1' },
          values: [
            { pageId: 'row-1', propertyId: 'p1', value: { type: 'text', value: 'a' } },
          ],
        },
        { row: { id: 'row-2' }, values: [] },
      ]);
    });

    it('resolves filters/sorts against db properties and passes options', async () => {
      propertyRepo.findByDatabaseId.mockResolvedValue([
        { id: 'p-num', type: 'number' },
        { id: 'p-txt', type: 'text' },
      ] as any);

      await service.listRows(user, {
        databaseId: 'db-1',
        filters: [{ propertyId: 'p-num', op: 'gte', value: 100 }],
        sorts: [{ propertyId: 'p-txt', direction: 'desc' }],
      } as any);

      expect(databaseRepo.listRows).toHaveBeenCalledWith('dbpage-1', {
        filters: [
          {
            propertyId: 'p-num',
            propertyType: 'number',
            op: 'gte',
            value: 100,
          },
        ],
        sorts: [
          { propertyId: 'p-txt', propertyType: 'text', direction: 'desc' },
        ],
      });
    });

    it('rejects an op not allowed for the property type (400)', async () => {
      propertyRepo.findByDatabaseId.mockResolvedValue([
        { id: 'p-sel', type: 'select' },
      ] as any);

      await expect(
        service.listRows(user, {
          databaseId: 'db-1',
          filters: [{ propertyId: 'p-sel', op: 'contains', value: 'x' }],
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(databaseRepo.listRows).not.toHaveBeenCalled();
    });

    it('rejects a non-numeric value on a number property (400)', async () => {
      propertyRepo.findByDatabaseId.mockResolvedValue([
        { id: 'p-num', type: 'number' },
      ] as any);

      await expect(
        service.listRows(user, {
          databaseId: 'db-1',
          filters: [{ propertyId: 'p-num', op: 'gte', value: 'abc' }],
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(databaseRepo.listRows).not.toHaveBeenCalled();
    });

    it('rejects a malformed date value on a date property (400)', async () => {
      propertyRepo.findByDatabaseId.mockResolvedValue([
        { id: 'p-date', type: 'date' },
      ] as any);

      await expect(
        service.listRows(user, {
          databaseId: 'db-1',
          filters: [{ propertyId: 'p-date', op: 'eq', value: 'not-a-date' }],
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(databaseRepo.listRows).not.toHaveBeenCalled();
    });

    it('passes is_empty without a value (and normalizes value to undefined)', async () => {
      propertyRepo.findByDatabaseId.mockResolvedValue([
        { id: 'p-num', type: 'number' },
      ] as any);

      await service.listRows(user, {
        databaseId: 'db-1',
        filters: [{ propertyId: 'p-num', op: 'is_empty' }],
      } as any);

      expect(databaseRepo.listRows).toHaveBeenCalledWith('dbpage-1', {
        filters: [
          {
            propertyId: 'p-num',
            propertyType: 'number',
            op: 'is_empty',
            value: undefined,
          },
        ],
        sorts: [],
      });
    });

    it('rejects a filter on a property not in this database (400)', async () => {
      propertyRepo.findByDatabaseId.mockResolvedValue([] as any);

      await expect(
        service.listRows(user, {
          databaseId: 'db-1',
          filters: [{ propertyId: 'foreign', op: 'eq', value: 'x' }],
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('requires read permission', async () => {
      spaceAbility.createForUser.mockResolvedValue(abilityMock(false) as any);
      await expect(
        service.listRows(user, { databaseId: 'db-1' } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('deleteRows', () => {
    it('requires edit permission', async () => {
      spaceAbility.createForUser.mockResolvedValue(abilityMock(false) as any);
      await expect(
        service.deleteRows(user, workspace, {
          databaseId: 'db-1',
          pageIds: ['row-1'],
        } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(pageService.removePage).not.toHaveBeenCalled();
    });

    it('rejects a page that is not a live row of this database', async () => {
      pageRepo.findById.mockResolvedValue({
        id: 'row-x',
        parentPageId: 'other-page',
      } as any);
      await expect(
        service.deleteRows(user, workspace, {
          databaseId: 'db-1',
          pageIds: ['row-x'],
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(pageService.removePage).not.toHaveBeenCalled();
    });

    it('rejects an already-deleted row', async () => {
      pageRepo.findById.mockResolvedValue({
        id: 'row-1',
        parentPageId: 'dbpage-1',
        deletedAt: new Date(),
      } as any);
      await expect(
        service.deleteRows(user, workspace, {
          databaseId: 'db-1',
          pageIds: ['row-1'],
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('soft-deletes each valid row via removePage', async () => {
      pageRepo.findById.mockImplementation(
        async (id: string) =>
          ({ id, parentPageId: 'dbpage-1' }) as any,
      );

      const result = await service.deleteRows(user, workspace, {
        databaseId: 'db-1',
        pageIds: ['row-1', 'row-2'],
      } as any);

      expect(pageService.removePage).toHaveBeenCalledTimes(2);
      expect(pageService.removePage).toHaveBeenCalledWith(
        'row-1',
        'user-1',
        'ws-1',
      );
      expect(result).toEqual({ deleted: 2 });
    });
  });

  describe('setValue', () => {
    const property: any = {
      id: 'p1',
      databaseId: 'db-1',
      type: 'text',
      config: {},
    };

    it('rejects a value whose type mismatches the property', async () => {
      propertyRepo.findById.mockResolvedValue(property);
      pageRepo.findById.mockResolvedValue({
        id: 'row-1',
        parentPageId: 'dbpage-1',
      } as any);

      await expect(
        service.setValue(user, {
          pageId: 'row-1',
          propertyId: 'p1',
          value: { type: 'number', value: 1 },
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(valueRepo.setValue).not.toHaveBeenCalled();
    });

    it('rejects a row that does not belong to the database', async () => {
      propertyRepo.findById.mockResolvedValue(property);
      pageRepo.findById.mockResolvedValue({
        id: 'row-x',
        parentPageId: 'other-page',
      } as any);

      await expect(
        service.setValue(user, {
          pageId: 'row-x',
          propertyId: 'p1',
          value: { type: 'text', value: 'hi' },
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('upserts a valid value', async () => {
      propertyRepo.findById.mockResolvedValue(property);
      pageRepo.findById.mockResolvedValue({
        id: 'row-1',
        parentPageId: 'dbpage-1',
      } as any);
      valueRepo.setValue.mockResolvedValue({ id: 'v1' } as any);

      await service.setValue(user, {
        pageId: 'row-1',
        propertyId: 'p1',
        value: { type: 'text', value: 'hi' },
      } as any);

      expect(valueRepo.setValue).toHaveBeenCalledWith({
        pageId: 'row-1',
        propertyId: 'p1',
        value: { type: 'text', value: 'hi' },
      });
    });

    it('throws NotFound when the property is missing', async () => {
      propertyRepo.findById.mockResolvedValue(undefined);
      await expect(
        service.setValue(user, {
          pageId: 'row-1',
          propertyId: 'missing',
          value: { type: 'text', value: 'x' },
        } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('setValue — relation membership', () => {
    const relationProperty: any = {
      id: 'rel-1',
      databaseId: 'db-1',
      type: 'relation',
      config: { targetDatabaseId: 'target-db' },
    };
    const targetDatabase: any = {
      id: 'target-db',
      pageId: 'target-page',
      spaceId: 'space-2',
      workspaceId: 'ws-1',
    };

    beforeEach(() => {
      // db-1 is the property's own database; target-db is the relation target.
      databaseRepo.findById.mockImplementation(async (id: string) =>
        id === 'target-db' ? targetDatabase : database,
      );
      propertyRepo.findById.mockResolvedValue(relationProperty);
      // The source row belongs to db-1.
      pageRepo.findById.mockResolvedValue({
        id: 'row-1',
        parentPageId: 'dbpage-1',
      } as any);
    });

    it('accepts page ids that are live rows of the target database', async () => {
      pageRepo.findManyByIds.mockResolvedValue([
        { id: 'p-a', parentPageId: 'target-page' },
        { id: 'p-b', parentPageId: 'target-page' },
      ] as any);
      valueRepo.setValue.mockResolvedValue({ id: 'v1' } as any);

      await service.setValue(user, {
        pageId: 'row-1',
        propertyId: 'rel-1',
        value: { type: 'relation', value: ['p-a', 'p-b'] },
      } as any);

      expect(databaseRepo.findById).toHaveBeenCalledWith('target-db');
      expect(pageRepo.findManyByIds).toHaveBeenCalledWith(['p-a', 'p-b'], {
        workspaceId: 'ws-1',
      });
      expect(valueRepo.setValue).toHaveBeenCalledWith({
        pageId: 'row-1',
        propertyId: 'rel-1',
        value: { type: 'relation', value: ['p-a', 'p-b'] },
      });
    });

    it('allows an empty array (clear-equivalent) without querying pages', async () => {
      valueRepo.setValue.mockResolvedValue({ id: 'v1' } as any);

      await service.setValue(user, {
        pageId: 'row-1',
        propertyId: 'rel-1',
        value: { type: 'relation', value: [] },
      } as any);

      expect(pageRepo.findManyByIds).not.toHaveBeenCalled();
      expect(valueRepo.setValue).toHaveBeenCalled();
    });

    it('rejects ids that are not rows of the target database', async () => {
      pageRepo.findManyByIds.mockResolvedValue([
        { id: 'p-a', parentPageId: 'other-page' },
      ] as any);

      await expect(
        service.setValue(user, {
          pageId: 'row-1',
          propertyId: 'rel-1',
          value: { type: 'relation', value: ['p-a'] },
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(valueRepo.setValue).not.toHaveBeenCalled();
    });

    it('rejects missing/deleted/foreign-workspace ids (not returned by query)', async () => {
      // findManyByIds filters deletedAt + workspaceId, so a bad id is absent.
      pageRepo.findManyByIds.mockResolvedValue([
        { id: 'p-a', parentPageId: 'target-page' },
      ] as any);

      await expect(
        service.setValue(user, {
          pageId: 'row-1',
          propertyId: 'rel-1',
          value: { type: 'relation', value: ['p-a', 'p-missing'] },
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(valueRepo.setValue).not.toHaveBeenCalled();
    });

    it('throws BadRequest when the target database no longer exists', async () => {
      databaseRepo.findById.mockImplementation(async (id: string) =>
        id === 'target-db' ? undefined : database,
      );
      pageRepo.findManyByIds.mockResolvedValue([] as any);

      await expect(
        service.setValue(user, {
          pageId: 'row-1',
          propertyId: 'rel-1',
          value: { type: 'relation', value: ['p-a'] },
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('clearValue', () => {
    it('clears after permission and row-membership check', async () => {
      propertyRepo.findById.mockResolvedValue({
        id: 'p1',
        databaseId: 'db-1',
      } as any);
      pageRepo.findById.mockResolvedValue({
        id: 'row-1',
        parentPageId: 'dbpage-1',
      } as any);

      await service.clearValue(user, {
        pageId: 'row-1',
        propertyId: 'p1',
      } as any);
      expect(valueRepo.clearValue).toHaveBeenCalledWith('row-1', 'p1');
    });

    it('rejects clearing a value on a row outside the database', async () => {
      propertyRepo.findById.mockResolvedValue({
        id: 'p1',
        databaseId: 'db-1',
      } as any);
      pageRepo.findById.mockResolvedValue({
        id: 'row-x',
        parentPageId: 'other-page',
      } as any);

      await expect(
        service.clearValue(user, {
          pageId: 'row-x',
          propertyId: 'p1',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(valueRepo.clearValue).not.toHaveBeenCalled();
    });
  });
});
