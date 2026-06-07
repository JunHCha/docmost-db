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

// ability that allows `action` (and everything weaker). Read < Edit.
function abilityFor(actions: SpaceCaslAction[]) {
  return {
    can: jest.fn((action: SpaceCaslAction) => actions.includes(action)),
    cannot: jest.fn((action: SpaceCaslAction) => !actions.includes(action)),
  };
}

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
      | 'findByScope'
      | 'insertView'
      | 'updateView'
      | 'deleteView'
      | 'clearDefaultViews'
      | 'softDeleteOrphans'
      | 'restoreOrphans'
      | 'hardDeleteOrphanedBefore'
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
      findByScope: jest.fn().mockResolvedValue([]),
      insertView: jest.fn().mockImplementation((v) => ({ id: 'v-new', ...v })),
      updateView: jest.fn(),
      deleteView: jest.fn(),
      clearDefaultViews: jest.fn(),
      softDeleteOrphans: jest.fn(),
      restoreOrphans: jest.fn(),
      hardDeleteOrphanedBefore: jest.fn(),
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
    jest
      .spyOn(service as any, 'runInTransaction')
      .mockImplementation((cb: any) => cb(trx));
  });

  describe('create', () => {
    it('throws Forbidden creating a shared view without edit permission', async () => {
      spaceAbility.createForUser.mockResolvedValue(
        abilityFor([SpaceCaslAction.Read]) as any,
      );
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

    it('appends a shared view and marks the first one default', async () => {
      viewRepo.findByScope.mockResolvedValue([]);
      const result = await service.create(user, {
        databaseId: 'db-1',
        name: 'Grid',
      } as any);
      expect(viewRepo.insertView).toHaveBeenCalledWith(
        expect.objectContaining({
          databaseId: 'db-1',
          name: 'Grid',
          type: 'table',
          isDefault: true,
          embedId: null,
          ownerUserId: null,
          sourcePageId: null,
          position: expect.any(String),
        }),
      );
      expect(result.isDefault).toBe(true);
    });

    it('does not mark default when other views exist in the scope', async () => {
      viewRepo.findByScope.mockResolvedValue([
        { id: 'v1', position: 'a0', isDefault: true } as any,
      ]);
      await service.create(user, { databaseId: 'db-1', name: 'Second' } as any);
      expect(viewRepo.insertView).toHaveBeenCalledWith(
        expect.objectContaining({ isDefault: false }),
      );
    });

    it('lets a read-only user create a personal view (owner = self)', async () => {
      spaceAbility.createForUser.mockResolvedValue(
        abilityFor([SpaceCaslAction.Read]) as any,
      );
      viewRepo.findByScope.mockResolvedValue([]);
      await service.create(user, {
        databaseId: 'db-1',
        name: 'My view',
        visibility: 'personal',
      } as any);
      expect(viewRepo.insertView).toHaveBeenCalledWith(
        expect.objectContaining({ ownerUserId: 'user-1', embedId: null }),
      );
    });

    it('scopes a created view to the given embed (original rows untouched)', async () => {
      viewRepo.findByScope.mockResolvedValue([]);
      await service.create(user, {
        databaseId: 'db-1',
        name: 'Embed view',
        embedId: 'embed-x',
      } as any);
      expect(viewRepo.insertView).toHaveBeenCalledWith(
        expect.objectContaining({ embedId: 'embed-x', ownerUserId: null }),
      );
    });

    it('records sourcePageId for an embed view created with a pageId', async () => {
      viewRepo.findByScope.mockResolvedValue([]);
      await service.create(user, {
        databaseId: 'db-1',
        name: 'Embed view',
        embedId: 'embed-x',
        pageId: 'page-1',
      } as any);
      expect(viewRepo.insertView).toHaveBeenCalledWith(
        expect.objectContaining({ embedId: 'embed-x', sourcePageId: 'page-1' }),
      );
    });

    it('keeps sourcePageId null for an original DB view even with a pageId', async () => {
      viewRepo.findByScope.mockResolvedValue([]);
      await service.create(user, {
        databaseId: 'db-1',
        name: 'Original',
        pageId: 'page-1',
      } as any);
      expect(viewRepo.insertView).toHaveBeenCalledWith(
        expect.objectContaining({ embedId: null, sourcePageId: null }),
      );
    });
  });

  describe('list', () => {
    it('returns the scope views (shared + own personal)', async () => {
      const views: any = [{ id: 'v1' }, { id: 'v2' }];
      viewRepo.findByScope.mockResolvedValue(views);
      const result = await service.list(user, { databaseId: 'db-1' } as any);
      expect(spaceAbility.createForUser).toHaveBeenCalledWith(user, 'space-1');
      expect(viewRepo.findByScope).toHaveBeenCalledWith({
        databaseId: 'db-1',
        embedId: null,
        ownerUserId: 'user-1',
      });
      expect(result).toBe(views);
    });

    it('lazily creates a default table view when the original scope is empty', async () => {
      viewRepo.findByScope.mockResolvedValueOnce([]);
      const result = await service.list(user, { databaseId: 'db-1' } as any);
      expect(viewRepo.insertView).toHaveBeenCalledWith(
        expect.objectContaining({
          databaseId: 'db-1',
          type: 'table',
          isDefault: true,
          embedId: null,
          ownerUserId: null,
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('re-reads when a concurrent lazy create wins the unique race', async () => {
      const created: any = [{ id: 'v-other', isDefault: true }];
      viewRepo.findByScope
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(created);
      viewRepo.insertView.mockRejectedValueOnce({ code: '23505' });
      const result = await service.list(user, { databaseId: 'db-1' } as any);
      expect(result).toBe(created);
    });

    it('rethrows non-unique insert errors', async () => {
      viewRepo.findByScope.mockResolvedValueOnce([]);
      viewRepo.insertView.mockRejectedValueOnce({ code: '42P01' });
      await expect(
        service.list(user, { databaseId: 'db-1' } as any),
      ).rejects.toMatchObject({ code: '42P01' });
    });

    it('seeds an empty embed scope by cloning original shared views', async () => {
      // embed scope empty, original scope has one shared view to clone.
      viewRepo.findByScope
        .mockResolvedValueOnce([]) // embed scope
        .mockResolvedValueOnce([
          {
            id: 'orig-1',
            name: 'Table',
            type: 'table',
            config: { a: 1 },
            position: 'a0',
            isDefault: true,
            embedId: null,
            ownerUserId: null,
          } as any,
        ]); // original shared scope
      const result = await service.list(user, {
        databaseId: 'db-1',
        embedId: 'embed-x',
        pageId: 'page-1',
      } as any);
      expect(viewRepo.insertView).toHaveBeenCalledWith(
        expect.objectContaining({
          databaseId: 'db-1',
          name: 'Table',
          embedId: 'embed-x',
          ownerUserId: null,
          isDefault: true,
          sourcePageId: 'page-1',
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('lazily creates a default view when both embed and original scopes are empty', async () => {
      viewRepo.findByScope
        .mockResolvedValueOnce([]) // embed scope
        .mockResolvedValueOnce([]); // original scope
      await service.list(user, {
        databaseId: 'db-1',
        embedId: 'embed-x',
      } as any);
      expect(viewRepo.insertView).toHaveBeenCalledWith(
        expect.objectContaining({ embedId: 'embed-x', isDefault: true }),
      );
    });
  });

  describe('update', () => {
    it('patches name and config of a shared view', async () => {
      viewRepo.findById
        .mockResolvedValueOnce({
          id: 'v1',
          databaseId: 'db-1',
          ownerUserId: null,
        } as any)
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

    it('lets the owner update their personal view with only Read', async () => {
      spaceAbility.createForUser.mockResolvedValue(
        abilityFor([SpaceCaslAction.Read]) as any,
      );
      viewRepo.findById
        .mockResolvedValueOnce({
          id: 'v1',
          databaseId: 'db-1',
          ownerUserId: 'user-1',
        } as any)
        .mockResolvedValueOnce({ id: 'v1', name: 'Renamed' } as any);
      await service.update(user, { viewId: 'v1', name: 'Renamed' } as any);
      expect(viewRepo.updateView).toHaveBeenCalled();
    });

    it("forbids updating another user's personal view", async () => {
      viewRepo.findById.mockResolvedValue({
        id: 'v1',
        databaseId: 'db-1',
        ownerUserId: 'someone-else',
      } as any);
      await expect(
        service.update(user, { viewId: 'v1', name: 'x' } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(viewRepo.updateView).not.toHaveBeenCalled();
    });

    it('forbids updating a shared view without Edit', async () => {
      spaceAbility.createForUser.mockResolvedValue(
        abilityFor([SpaceCaslAction.Read]) as any,
      );
      viewRepo.findById.mockResolvedValue({
        id: 'v1',
        databaseId: 'db-1',
        ownerUserId: null,
      } as any);
      await expect(
        service.update(user, { viewId: 'v1', name: 'x' } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFound for a missing view', async () => {
      viewRepo.findById.mockResolvedValue(undefined);
      await expect(
        service.update(user, { viewId: 'gone' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('setDefault', () => {
    it('clears defaults in the view scope then flips the target', async () => {
      viewRepo.findById.mockResolvedValue({
        id: 'v2',
        databaseId: 'db-1',
        embedId: 'embed-x',
        ownerUserId: 'user-1',
      } as any);
      await service.setDefault(user, { viewId: 'v2' } as any);
      expect(viewRepo.clearDefaultViews).toHaveBeenCalledWith(
        { databaseId: 'db-1', embedId: 'embed-x', ownerUserId: 'user-1' },
        trx,
      );
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
    it('blocks deleting the last view in the scope', async () => {
      viewRepo.findById.mockResolvedValue({
        id: 'v1',
        databaseId: 'db-1',
        ownerUserId: null,
      } as any);
      viewRepo.findByScope.mockResolvedValue([{ id: 'v1' } as any]);
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
        ownerUserId: null,
      } as any);
      viewRepo.findByScope.mockResolvedValue([
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
        ownerUserId: null,
      } as any);
      viewRepo.findByScope.mockResolvedValue([
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

    it("forbids deleting another user's personal view", async () => {
      viewRepo.findById.mockResolvedValue({
        id: 'v1',
        databaseId: 'db-1',
        ownerUserId: 'someone-else',
      } as any);
      await expect(
        service.delete(user, { viewId: 'v1' } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('reconcileEmbedViews', () => {
    it('soft-deletes orphans (keep = doc embedIds) then restores re-appeared', async () => {
      const doc = {
        type: 'doc',
        content: [
          { type: 'databaseView', attrs: { embedId: 'e1' } },
          { type: 'databaseView', attrs: { embedId: 'e2' } },
        ],
      };
      await service.reconcileEmbedViews('page-1', doc);
      expect(viewRepo.softDeleteOrphans).toHaveBeenCalledWith(
        { sourcePageId: 'page-1', keepEmbedIds: ['e1', 'e2'] },
        trx,
      );
      expect(viewRepo.restoreOrphans).toHaveBeenCalledWith(
        { sourcePageId: 'page-1', embedIds: ['e1', 'e2'] },
        trx,
      );
      const softOrder = viewRepo.softDeleteOrphans.mock.invocationCallOrder[0];
      const restoreOrder = viewRepo.restoreOrphans.mock.invocationCallOrder[0];
      expect(softOrder).toBeLessThan(restoreOrder);
    });

    it('passes an empty keep list when the page has no embeds', async () => {
      await service.reconcileEmbedViews('page-1', { type: 'doc', content: [] });
      expect(viewRepo.softDeleteOrphans).toHaveBeenCalledWith(
        { sourcePageId: 'page-1', keepEmbedIds: [] },
        trx,
      );
    });
  });
});
