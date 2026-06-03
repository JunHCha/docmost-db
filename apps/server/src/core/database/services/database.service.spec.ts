// Stub PageService's module so its heavy transitive imports (prosemirror /
// @tiptap/pm, pulled in via the export utils) are never loaded in this unit
// test. We only need the class as a DI token.
jest.mock('../../page/services/page.service', () => ({
  PageService: class PageService {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { PageService } from '../../page/services/page.service';
import { DatabaseRepo } from '@docmost/db/repos/database/database.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import SpaceAbilityFactory from '../../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../casl/interfaces/space-ability.type';

const user: any = { id: 'user-1' };
const workspace: any = { id: 'ws-1' };

function abilityMock(allowed: boolean) {
  return {
    can: jest.fn().mockReturnValue(allowed),
    cannot: jest.fn().mockReturnValue(!allowed),
  };
}

describe('DatabaseService', () => {
  let service: DatabaseService;
  let pageService: jest.Mocked<Pick<PageService, 'create'>>;
  let databaseRepo: jest.Mocked<
    Pick<
      DatabaseRepo,
      'insertDatabase' | 'findById' | 'findByPageId' | 'findBySpaceId'
    >
  >;
  let pageRepo: jest.Mocked<Pick<PageRepo, 'findById' | 'deletePage'>>;
  let spaceAbility: jest.Mocked<Pick<SpaceAbilityFactory, 'createForUser'>>;

  beforeEach(async () => {
    pageService = { create: jest.fn() } as any;
    databaseRepo = {
      insertDatabase: jest.fn(),
      findById: jest.fn(),
      findByPageId: jest.fn(),
      findBySpaceId: jest.fn(),
    } as any;
    pageRepo = { findById: jest.fn(), deletePage: jest.fn() } as any;
    spaceAbility = { createForUser: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseService,
        { provide: PageService, useValue: pageService },
        { provide: DatabaseRepo, useValue: databaseRepo },
        { provide: PageRepo, useValue: pageRepo },
        { provide: SpaceAbilityFactory, useValue: spaceAbility },
      ],
    }).compile();

    service = module.get<DatabaseService>(DatabaseService);
  });

  describe('create', () => {
    const dto: any = { spaceId: 'space-1', title: 'Tasks' };

    it('throws Forbidden and does not create a page when lacking permission', async () => {
      spaceAbility.createForUser.mockResolvedValue(abilityMock(false) as any);

      await expect(service.create(user, workspace, dto)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(pageService.create).not.toHaveBeenCalled();
      expect(databaseRepo.insertDatabase).not.toHaveBeenCalled();
    });

    it('creates a database-typed page and its meta row', async () => {
      const ability = abilityMock(true);
      spaceAbility.createForUser.mockResolvedValue(ability as any);
      const page: any = { id: 'page-1', spaceId: 'space-1' };
      const database: any = { id: 'db-1', pageId: 'page-1' };
      pageService.create.mockResolvedValue(page);
      databaseRepo.insertDatabase.mockResolvedValue(database);

      const result = await service.create(user, workspace, dto);

      expect(ability.cannot).toHaveBeenCalledWith(
        SpaceCaslAction.Create,
        SpaceCaslSubject.Page,
      );
      // page created through the existing page path, typed as 'database'
      expect(pageService.create).toHaveBeenCalledWith(
        user.id,
        workspace.id,
        expect.objectContaining({ spaceId: 'space-1', title: 'Tasks' }),
        'database',
      );
      expect(databaseRepo.insertDatabase).toHaveBeenCalledWith({
        pageId: 'page-1',
        spaceId: 'space-1',
        workspaceId: 'ws-1',
      });
      expect(result).toEqual({ database, page });
    });

    it('compensates by deleting the page when meta insert fails', async () => {
      spaceAbility.createForUser.mockResolvedValue(abilityMock(true) as any);
      const page: any = { id: 'page-1', spaceId: 'space-1' };
      pageService.create.mockResolvedValue(page);
      databaseRepo.insertDatabase.mockRejectedValue(new Error('constraint'));

      await expect(service.create(user, workspace, dto)).rejects.toThrow(
        'constraint',
      );
      expect(pageRepo.deletePage).toHaveBeenCalledWith('page-1');
    });
  });

  describe('info', () => {
    it('throws NotFound when the database does not exist', async () => {
      databaseRepo.findById.mockResolvedValue(undefined);

      await expect(
        service.info(user, { databaseId: 'missing' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws Forbidden when lacking read permission', async () => {
      databaseRepo.findById.mockResolvedValue({
        id: 'db-1',
        pageId: 'page-1',
        spaceId: 'space-1',
      } as any);
      spaceAbility.createForUser.mockResolvedValue(abilityMock(false) as any);

      await expect(
        service.info(user, { databaseId: 'db-1' } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFound when the database page is trashed (soft-deleted)', async () => {
      databaseRepo.findById.mockResolvedValue({
        id: 'db-1',
        pageId: 'page-1',
        spaceId: 'space-1',
      } as any);
      spaceAbility.createForUser.mockResolvedValue(abilityMock(true) as any);
      pageRepo.findById.mockResolvedValue({
        id: 'page-1',
        deletedAt: new Date(),
      } as any);

      await expect(
        service.info(user, { databaseId: 'db-1' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns the database and its page', async () => {
      const database: any = {
        id: 'db-1',
        pageId: 'page-1',
        spaceId: 'space-1',
      };
      const page: any = { id: 'page-1' };
      databaseRepo.findById.mockResolvedValue(database);
      spaceAbility.createForUser.mockResolvedValue(abilityMock(true) as any);
      pageRepo.findById.mockResolvedValue(page);

      const result = await service.info(user, { databaseId: 'db-1' } as any);

      expect(result).toEqual({ database, page });
    });

    describe('by pageId', () => {
      it('resolves the database via findByPageId and returns it with its page', async () => {
        const database: any = {
          id: 'db-1',
          pageId: 'page-1',
          spaceId: 'space-1',
        };
        const page: any = { id: 'page-1' };
        databaseRepo.findByPageId.mockResolvedValue(database);
        spaceAbility.createForUser.mockResolvedValue(abilityMock(true) as any);
        pageRepo.findById.mockResolvedValue(page);

        const result = await service.info(user, { pageId: 'page-1' } as any);

        expect(databaseRepo.findByPageId).toHaveBeenCalledWith('page-1');
        expect(databaseRepo.findById).not.toHaveBeenCalled();
        expect(result).toEqual({ database, page });
      });

      it('throws NotFound when no database exists for the page', async () => {
        databaseRepo.findByPageId.mockResolvedValue(undefined);

        await expect(
          service.info(user, { pageId: 'missing' } as any),
        ).rejects.toBeInstanceOf(NotFoundException);
      });

      it('throws Forbidden when lacking read permission', async () => {
        databaseRepo.findByPageId.mockResolvedValue({
          id: 'db-1',
          pageId: 'page-1',
          spaceId: 'space-1',
        } as any);
        spaceAbility.createForUser.mockResolvedValue(abilityMock(false) as any);

        await expect(
          service.info(user, { pageId: 'page-1' } as any),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });

      it('throws NotFound when the database page is trashed (soft-deleted)', async () => {
        databaseRepo.findByPageId.mockResolvedValue({
          id: 'db-1',
          pageId: 'page-1',
          spaceId: 'space-1',
        } as any);
        spaceAbility.createForUser.mockResolvedValue(abilityMock(true) as any);
        pageRepo.findById.mockResolvedValue({
          id: 'page-1',
          deletedAt: new Date(),
        } as any);

        await expect(
          service.info(user, { pageId: 'page-1' } as any),
        ).rejects.toBeInstanceOf(NotFoundException);
      });
    });
  });

  describe('list', () => {
    it('throws Forbidden when lacking read permission', async () => {
      spaceAbility.createForUser.mockResolvedValue(abilityMock(false) as any);

      await expect(
        service.list(user, { spaceId: 'space-1' } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(databaseRepo.findBySpaceId).not.toHaveBeenCalled();
    });

    it('returns databases in the space', async () => {
      const rows: any = [{ id: 'db-1' }, { id: 'db-2' }];
      spaceAbility.createForUser.mockResolvedValue(abilityMock(true) as any);
      databaseRepo.findBySpaceId.mockResolvedValue(rows);

      const result = await service.list(user, { spaceId: 'space-1' } as any);

      expect(databaseRepo.findBySpaceId).toHaveBeenCalledWith('space-1');
      expect(result).toBe(rows);
    });
  });
});
