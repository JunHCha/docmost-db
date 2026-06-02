import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DatabasePropertyService } from './database-property.service';
import { DatabasePropertyRepo } from '@docmost/db/repos/database/database-property.repo';
import { DatabaseRepo } from '@docmost/db/repos/database/database.repo';
import SpaceAbilityFactory from '../../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../casl/interfaces/space-ability.type';

const user: any = { id: 'user-1' };
const database: any = { id: 'db-1', spaceId: 'space-1', workspaceId: 'ws-1' };

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
  let databaseRepo: jest.Mocked<Pick<DatabaseRepo, 'findById'>>;
  let spaceAbility: jest.Mocked<Pick<SpaceAbilityFactory, 'createForUser'>>;

  beforeEach(async () => {
    propertyRepo = {
      findById: jest.fn(),
      findByDatabaseId: jest.fn().mockResolvedValue([]),
      insertProperty: jest.fn().mockImplementation((v) => ({ id: 'p-new', ...v })),
      updateProperty: jest.fn(),
      softDeleteProperty: jest.fn(),
    } as any;
    databaseRepo = { findById: jest.fn().mockResolvedValue(database) } as any;
    spaceAbility = {
      createForUser: jest.fn().mockResolvedValue(abilityMock(true)),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabasePropertyService,
        { provide: DatabasePropertyRepo, useValue: propertyRepo },
        { provide: DatabaseRepo, useValue: databaseRepo },
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
