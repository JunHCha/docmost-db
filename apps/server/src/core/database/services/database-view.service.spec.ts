import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DatabaseViewService } from './database-view.service';
import { DatabaseViewRepo } from '@docmost/db/repos/database/database-view.repo';
import { DatabaseRepo } from '@docmost/db/repos/database/database.repo';
import { KYSELY_MODULE_CONNECTION_TOKEN } from 'nestjs-kysely';
import SpaceAbilityFactory from '../../casl/abilities/space-ability.factory';
import { SpaceCaslAction, SpaceCaslSubject } from '../../casl/interfaces/space-ability.type';

const user: any = { id: 'user-1' };
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

describe('DatabaseViewService', () => {
  let service: DatabaseViewService;
  let viewRepo: jest.Mocked<
    Pick<
      DatabaseViewRepo,
      | 'findById'
      | 'findByDatabaseId'
      | 'insertView'
      | 'updateView'
      | 'deleteView'
      | 'clearDefaultViews'
    >
  >;
  let databaseRepo: jest.Mocked<Pick<DatabaseRepo, 'findById'>>;
  let spaceAbility: jest.Mocked<Pick<SpaceAbilityFactory, 'createForUser'>>;
  let trx: any;

  beforeEach(async () => {
    trx = {};
    viewRepo = {
      findById: jest.fn(),
      findByDatabaseId: jest.fn().mockResolvedValue([]),
      insertView: jest.fn().mockImplementation((v) => ({ id: 'v-new', ...v })),
      updateView: jest.fn(),
      deleteView: jest.fn(),
      clearDefaultViews: jest.fn(),
    } as any;
    databaseRepo = {
      findById: jest.fn().mockResolvedValue(database),
    } as any;
    spaceAbility = {
      createForUser: jest.fn().mockResolvedValue(abilityMock(true)),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseViewService,
        { provide: DatabaseViewRepo, useValue: viewRepo },
        { provide: DatabaseRepo, useValue: databaseRepo },
        { provide: SpaceAbilityFactory, useValue: spaceAbility },
        { provide: KYSELY_MODULE_CONNECTION_TOKEN(), useValue: {} },
      ],
    }).compile();

    service = module.get<DatabaseViewService>(DatabaseViewService);
    // executeTx runs the callback with our fake trx by default.
    jest
      .spyOn(service as any, 'runInTransaction')
      .mockImplementation((cb: any) => cb(trx));
  });

  describe('create', () => {
    it('throws Forbidden without edit permission', async () => {
      spaceAbility.createForUser.mockResolvedValue(abilityMock(false) as any);
      await expect(
        service.create(user, { databaseId: 'db-1', name: 'Grid' } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(viewRepo.insertView).not.toHaveBeenCalled();
    });

    it('throws NotFound when the database is missing', async () => {
      databaseRepo.findById.mockResolvedValue(undefined);
      await expect(
        service.create(user, { databaseId: 'missing', name: 'Grid' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('appends with a position and marks the first view default', async () => {
      viewRepo.findByDatabaseId.mockResolvedValue([]);
      const result = await service.create(user, {
        databaseId: 'db-1',
        name: 'Grid',
      } as any);
      expect(viewRepo.insertView).toHaveBeenCalledWith(
        expect.objectContaining({
          databaseId: 'db-1',
          name: 'Grid',
          type: 'grid',
          isDefault: true,
          position: expect.any(String),
        }),
      );
      expect(result.isDefault).toBe(true);
    });

    it('does not mark default when other views exist', async () => {
      viewRepo.findByDatabaseId.mockResolvedValue([
        { id: 'v1', position: 'a0', isDefault: true } as any,
      ]);
      await service.create(user, { databaseId: 'db-1', name: 'Second' } as any);
      expect(viewRepo.insertView).toHaveBeenCalledWith(
        expect.objectContaining({ isDefault: false }),
      );
    });
  });

  describe('list', () => {
    it('returns existing views', async () => {
      const views: any = [{ id: 'v1' }, { id: 'v2' }];
      viewRepo.findByDatabaseId.mockResolvedValue(views);
      const result = await service.list(user, { databaseId: 'db-1' } as any);
      expect(spaceAbility.createForUser).toHaveBeenCalledWith(user, 'space-1');
      expect(result).toBe(views);
    });

    it('lazily creates a default grid view when none exist', async () => {
      viewRepo.findByDatabaseId.mockResolvedValueOnce([]);
      const result = await service.list(user, { databaseId: 'db-1' } as any);
      expect(viewRepo.insertView).toHaveBeenCalledWith(
        expect.objectContaining({
          databaseId: 'db-1',
          type: 'grid',
          isDefault: true,
        }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('patches name and config', async () => {
      viewRepo.findById
        .mockResolvedValueOnce({ id: 'v1', databaseId: 'db-1' } as any)
        .mockResolvedValueOnce({ id: 'v1', name: 'Renamed' } as any);
      const result = await service.update(user, {
        viewId: 'v1',
        name: 'Renamed',
        config: { columns: [] },
      } as any);
      expect(viewRepo.updateView).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Renamed', config: { columns: [] } }),
        'v1',
      );
      expect(result).toEqual({ id: 'v1', name: 'Renamed' });
    });

    it('throws NotFound for a missing view', async () => {
      viewRepo.findById.mockResolvedValue(undefined);
      await expect(
        service.update(user, { viewId: 'gone' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('setDefault', () => {
    it('clears other defaults then flips the target inside a transaction', async () => {
      viewRepo.findById.mockResolvedValue({ id: 'v2', databaseId: 'db-1' } as any);
      await service.setDefault(user, { viewId: 'v2' } as any);
      expect(viewRepo.clearDefaultViews).toHaveBeenCalledWith('db-1', trx);
      expect(viewRepo.updateView).toHaveBeenCalledWith(
        { isDefault: true },
        'v2',
        trx,
      );
      const clearOrder =
        viewRepo.clearDefaultViews.mock.invocationCallOrder[0];
      const updateOrder = viewRepo.updateView.mock.invocationCallOrder[0];
      expect(clearOrder).toBeLessThan(updateOrder);
    });
  });

  describe('delete', () => {
    it('blocks deleting the last view', async () => {
      viewRepo.findById.mockResolvedValue({ id: 'v1', databaseId: 'db-1' } as any);
      viewRepo.findByDatabaseId.mockResolvedValue([{ id: 'v1' } as any]);
      await expect(
        service.delete(user, { viewId: 'v1' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(viewRepo.deleteView).not.toHaveBeenCalled();
    });

    it('deletes a non-default view', async () => {
      viewRepo.findById.mockResolvedValue({
        id: 'v2',
        databaseId: 'db-1',
        isDefault: false,
      } as any);
      viewRepo.findByDatabaseId.mockResolvedValue([
        { id: 'v1', isDefault: true } as any,
        { id: 'v2', isDefault: false } as any,
      ]);
      await service.delete(user, { viewId: 'v2' } as any);
      expect(viewRepo.deleteView).toHaveBeenCalledWith('v2', trx);
      expect(viewRepo.updateView).not.toHaveBeenCalled();
    });

    it('promotes another view when deleting the default one', async () => {
      viewRepo.findById.mockResolvedValue({
        id: 'v1',
        databaseId: 'db-1',
        isDefault: true,
      } as any);
      viewRepo.findByDatabaseId.mockResolvedValue([
        { id: 'v1', position: 'a0', isDefault: true } as any,
        { id: 'v2', position: 'a1', isDefault: false } as any,
      ]);
      await service.delete(user, { viewId: 'v1' } as any);
      expect(viewRepo.updateView).toHaveBeenCalledWith(
        { isDefault: true },
        'v2',
        trx,
      );
      expect(viewRepo.deleteView).toHaveBeenCalledWith('v1', trx);
    });
  });
});
