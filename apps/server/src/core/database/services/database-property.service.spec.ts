import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DatabasePropertyService } from './database-property.service';
import { DatabasePropertyRepo } from '@docmost/db/repos/database/database-property.repo';
import { DatabaseRepo } from '@docmost/db/repos/database/database.repo';
import { DatabasePropertyValueRepo } from '@docmost/db/repos/database/database-property-value.repo';
import SpaceAbilityFactory from '../../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../casl/interfaces/space-ability.type';

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

describe('DatabasePropertyService', () => {
  let service: DatabasePropertyService;
  let propertyRepo: jest.Mocked<
    Pick<
      DatabasePropertyRepo,
      | 'findById'
      | 'findByDatabaseId'
      | 'insertProperty'
      | 'updateProperty'
      | 'softDeleteProperty'
    >
  >;
  let databaseRepo: jest.Mocked<Pick<DatabaseRepo, 'findById' | 'listRows'>>;
  let valueRepo: jest.Mocked<
    Pick<DatabasePropertyValueRepo, 'setValue' | 'clearValue' | 'findByPageIds'>
  >;
  let spaceAbility: jest.Mocked<Pick<SpaceAbilityFactory, 'createForUser'>>;

  beforeEach(async () => {
    propertyRepo = {
      findById: jest.fn(),
      findByDatabaseId: jest.fn().mockResolvedValue([]),
      insertProperty: jest.fn().mockImplementation((v) => ({ id: 'p-new', ...v })),
      updateProperty: jest.fn(),
      softDeleteProperty: jest.fn(),
    } as any;
    databaseRepo = {
      findById: jest.fn().mockResolvedValue(database),
      listRows: jest.fn().mockResolvedValue([]),
    } as any;
    valueRepo = {
      setValue: jest.fn(),
      clearValue: jest.fn(),
      findByPageIds: jest.fn().mockResolvedValue([]),
    } as any;
    spaceAbility = {
      createForUser: jest.fn().mockResolvedValue(abilityMock(true)),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabasePropertyService,
        { provide: DatabasePropertyRepo, useValue: propertyRepo },
        { provide: DatabaseRepo, useValue: databaseRepo },
        { provide: DatabasePropertyValueRepo, useValue: valueRepo },
        { provide: SpaceAbilityFactory, useValue: spaceAbility },
      ],
    }).compile();

    service = module.get<DatabasePropertyService>(DatabasePropertyService);
  });

  describe('create', () => {
    it('throws Forbidden without edit permission', async () => {
      spaceAbility.createForUser.mockResolvedValue(abilityMock(false) as any);
      await expect(
        service.create(user, {
          databaseId: 'db-1',
          name: 'Status',
          type: 'text',
        } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(propertyRepo.insertProperty).not.toHaveBeenCalled();
    });

    it('throws NotFound when the database is missing', async () => {
      databaseRepo.findById.mockResolvedValue(undefined);
      await expect(
        service.create(user, {
          databaseId: 'missing',
          name: 'X',
          type: 'text',
        } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects unsupported types', async () => {
      await expect(
        service.create(user, {
          databaseId: 'db-1',
          name: 'X',
          type: 'formula',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects select without options', async () => {
      await expect(
        service.create(user, {
          databaseId: 'db-1',
          name: 'X',
          type: 'select',
          config: {},
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects relation whose target database does not exist', async () => {
      databaseRepo.findById.mockImplementation(async (id: string) =>
        id === 'db-1' ? database : undefined,
      );
      await expect(
        service.create(user, {
          databaseId: 'db-1',
          name: 'Rel',
          type: 'relation',
          config: { targetDatabaseId: 'db-2' },
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('checks Edit permission and inserts with a position', async () => {
      const ability = abilityMock(true);
      spaceAbility.createForUser.mockResolvedValue(ability as any);
      propertyRepo.findByDatabaseId.mockResolvedValue([
        { id: 'p1', position: 'a0' } as any,
      ]);

      const result = await service.create(user, {
        databaseId: 'db-1',
        name: 'Status',
        type: 'text',
      } as any);

      expect(ability.cannot).toHaveBeenCalledWith(
        SpaceCaslAction.Edit,
        SpaceCaslSubject.Page,
      );
      expect(propertyRepo.insertProperty).toHaveBeenCalledWith(
        expect.objectContaining({
          databaseId: 'db-1',
          name: 'Status',
          type: 'text',
          config: {},
          position: expect.any(String),
        }),
      );
      expect(result.position).toEqual(expect.any(String));
    });

    it('normalizes select option ids', async () => {
      await service.create(user, {
        databaseId: 'db-1',
        name: 'Status',
        type: 'select',
        config: { options: [{ label: 'Todo' }] },
      } as any);
      const arg = propertyRepo.insertProperty.mock.calls[0][0] as any;
      expect(arg.config.options[0].id).toEqual(expect.any(String));
      expect(arg.config.options[0].label).toBe('Todo');
    });
  });

  describe('update', () => {
    it('re-validates config when the type changes', async () => {
      propertyRepo.findById.mockResolvedValue({
        id: 'p1',
        databaseId: 'db-1',
        type: 'text',
        config: {},
      } as any);
      await expect(
        service.update(user, { propertyId: 'p1', type: 'select' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates name and returns the fresh row', async () => {
      propertyRepo.findById
        .mockResolvedValueOnce({
          id: 'p1',
          databaseId: 'db-1',
          type: 'text',
          config: {},
        } as any)
        .mockResolvedValueOnce({ id: 'p1', name: 'Renamed' } as any);

      const result = await service.update(user, {
        propertyId: 'p1',
        name: 'Renamed',
      } as any);

      expect(propertyRepo.updateProperty).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Renamed' }),
        'p1',
      );
      expect(result).toEqual({ id: 'p1', name: 'Renamed' });
    });

    it('does not migrate values when the type is unchanged', async () => {
      propertyRepo.findById
        .mockResolvedValueOnce({
          id: 'p1',
          databaseId: 'db-1',
          type: 'text',
          config: {},
        } as any)
        .mockResolvedValueOnce({ id: 'p1', name: 'Renamed' } as any);

      await service.update(user, {
        propertyId: 'p1',
        name: 'Renamed',
      } as any);

      expect(databaseRepo.listRows).not.toHaveBeenCalled();
      expect(valueRepo.findByPageIds).not.toHaveBeenCalled();
      expect(valueRepo.setValue).not.toHaveBeenCalled();
      expect(valueRepo.clearValue).not.toHaveBeenCalled();
    });

    const selectProp: any = {
      id: 'p1',
      databaseId: 'db-1',
      type: 'select',
      config: {
        options: [
          { id: 'opt-todo', label: 'Todo' },
          { id: 'opt-done', label: 'Done' },
        ],
      },
    };

    it('migrates select option ids to labels on select -> text', async () => {
      propertyRepo.findById
        .mockResolvedValueOnce(selectProp)
        .mockResolvedValueOnce({ id: 'p1', type: 'text' } as any);
      databaseRepo.listRows.mockResolvedValue([
        { id: 'row-1' },
        { id: 'row-2' },
        { id: 'row-3' },
      ] as any);
      valueRepo.findByPageIds.mockResolvedValue([
        { pageId: 'row-1', propertyId: 'p1', value: { type: 'select', value: 'opt-todo' } },
        { pageId: 'row-2', propertyId: 'p1', value: { type: 'select', value: 'unknown-id' } },
        { pageId: 'row-3', propertyId: 'other', value: { type: 'select', value: 'opt-done' } },
      ] as any);

      await service.update(user, { propertyId: 'p1', type: 'text' } as any);

      expect(valueRepo.setValue).toHaveBeenCalledWith({
        pageId: 'row-1',
        propertyId: 'p1',
        value: { type: 'text', value: 'Todo' },
      });
      expect(valueRepo.clearValue).toHaveBeenCalledWith('row-2', 'p1');
      // other property's value must be left untouched
      expect(valueRepo.setValue).toHaveBeenCalledTimes(1);
      expect(valueRepo.clearValue).toHaveBeenCalledTimes(1);
    });

    it('joins multi_select labels with ", " on multi_select -> text', async () => {
      propertyRepo.findById
        .mockResolvedValueOnce({
          ...selectProp,
          type: 'multi_select',
        })
        .mockResolvedValueOnce({ id: 'p1', type: 'text' } as any);
      databaseRepo.listRows.mockResolvedValue([{ id: 'row-1' }] as any);
      valueRepo.findByPageIds.mockResolvedValue([
        {
          pageId: 'row-1',
          propertyId: 'p1',
          value: { type: 'multi_select', value: ['opt-todo', 'opt-done', 'gone'] },
        },
      ] as any);

      await service.update(user, { propertyId: 'p1', type: 'text' } as any);

      expect(valueRepo.setValue).toHaveBeenCalledWith({
        pageId: 'row-1',
        propertyId: 'p1',
        value: { type: 'text', value: 'Todo, Done' },
      });
    });

    it('clears values on select -> number (label not representable)', async () => {
      propertyRepo.findById
        .mockResolvedValueOnce(selectProp)
        .mockResolvedValueOnce({ id: 'p1', type: 'number' } as any);
      databaseRepo.listRows.mockResolvedValue([{ id: 'row-1' }] as any);
      valueRepo.findByPageIds.mockResolvedValue([
        { pageId: 'row-1', propertyId: 'p1', value: { type: 'select', value: 'opt-todo' } },
      ] as any);

      await service.update(user, { propertyId: 'p1', type: 'number' } as any);

      expect(valueRepo.clearValue).toHaveBeenCalledWith('row-1', 'p1');
      expect(valueRepo.setValue).not.toHaveBeenCalled();
    });

    it('does not migrate on select -> multi_select (both option types)', async () => {
      propertyRepo.findById
        .mockResolvedValueOnce(selectProp)
        .mockResolvedValueOnce({ id: 'p1', type: 'multi_select' } as any);

      await service.update(user, {
        propertyId: 'p1',
        type: 'multi_select',
        config: { options: selectProp.config.options },
      } as any);

      expect(databaseRepo.listRows).not.toHaveBeenCalled();
      expect(valueRepo.setValue).not.toHaveBeenCalled();
      expect(valueRepo.clearValue).not.toHaveBeenCalled();
    });
  });

  describe('reorder', () => {
    it('computes a position after the given property', async () => {
      propertyRepo.findById.mockResolvedValue({
        id: 'p3',
        databaseId: 'db-1',
      } as any);
      propertyRepo.findByDatabaseId.mockResolvedValue([
        { id: 'p1', position: 'a0' },
        { id: 'p2', position: 'a1' },
        { id: 'p3', position: 'a2' },
      ] as any);

      await service.reorder(user, {
        propertyId: 'p3',
        afterPropertyId: 'p1',
      } as any);

      expect(propertyRepo.updateProperty).toHaveBeenCalledWith(
        expect.objectContaining({ position: expect.any(String) }),
        'p3',
      );
    });

    it('rejects moving a property after itself', async () => {
      propertyRepo.findById.mockResolvedValue({
        id: 'p3',
        databaseId: 'db-1',
      } as any);
      propertyRepo.findByDatabaseId.mockResolvedValue([
        { id: 'p1', position: 'a0' },
        { id: 'p3', position: 'a2' },
      ] as any);

      await expect(
        service.reorder(user, {
          propertyId: 'p3',
          afterPropertyId: 'p3',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(propertyRepo.updateProperty).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('soft-deletes after permission check', async () => {
      propertyRepo.findById.mockResolvedValue({
        id: 'p1',
        databaseId: 'db-1',
      } as any);
      await service.delete(user, { propertyId: 'p1' } as any);
      expect(propertyRepo.softDeleteProperty).toHaveBeenCalledWith('p1');
    });
  });

  describe('list', () => {
    it('requires read permission and returns ordered properties', async () => {
      const rows: any = [{ id: 'p1' }, { id: 'p2' }];
      propertyRepo.findByDatabaseId.mockResolvedValue(rows);
      const result = await service.list(user, { databaseId: 'db-1' } as any);
      expect(spaceAbility.createForUser).toHaveBeenCalledWith(user, 'space-1');
      expect(result).toBe(rows);
    });
  });
});
