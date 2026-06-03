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
  let pageService: jest.Mocked<Pick<PageService, 'create'>>;
  let databaseRepo: jest.Mocked<Pick<DatabaseRepo, 'findById' | 'listRows'>>;
  let propertyRepo: jest.Mocked<Pick<DatabasePropertyRepo, 'findById'>>;
  let valueRepo: jest.Mocked<
    Pick<DatabasePropertyValueRepo, 'findByPageIds' | 'setValue' | 'clearValue'>
  >;
  let pageRepo: jest.Mocked<Pick<PageRepo, 'findById' | 'findManyByIds'>>;
  let spaceAbility: jest.Mocked<Pick<SpaceAbilityFactory, 'createForUser'>>;

  beforeEach(async () => {
    pageService = { create: jest.fn() } as any;
    databaseRepo = {
      findById: jest.fn().mockResolvedValue(database),
      listRows: jest.fn().mockResolvedValue([]),
    } as any;
    propertyRepo = { findById: jest.fn() } as any;
    valueRepo = {
      findByPageIds: jest.fn().mockResolvedValue([]),
      setValue: jest.fn(),
      clearValue: jest.fn(),
    } as any;
    pageRepo = {
      findById: jest.fn(),
      findManyByIds: jest.fn().mockResolvedValue([]),
    } as any;
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
      expect(databaseRepo.listRows).toHaveBeenCalledWith('dbpage-1');
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
