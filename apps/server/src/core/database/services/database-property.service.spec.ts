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
  let databaseRepo: jest.Mocked<
    Pick<DatabaseRepo, 'findById' | 'listRows' | 'findTitleById'>
  >;
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
      // Titles drive the auto-named relation columns ("<title>와 관계됨").
      findTitleById: jest.fn().mockImplementation(async (id: string) =>
        id === 'db-1' ? 'Tasks' : id === 'db-2' ? 'Projects' : 'Other',
      ),
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
        type: 'number',
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

    const textProp: any = {
      id: 'p1',
      databaseId: 'db-1',
      type: 'text',
      config: {},
    };

    it('derives distinct options (case-insensitive) on text -> select', async () => {
      propertyRepo.findById
        .mockResolvedValueOnce(textProp)
        .mockResolvedValueOnce({ id: 'p1', type: 'select' } as any);
      databaseRepo.listRows.mockResolvedValue([
        { id: 'row-1' },
        { id: 'row-2' },
        { id: 'row-3' },
      ] as any);
      valueRepo.findByPageIds.mockResolvedValue([
        { pageId: 'row-1', propertyId: 'p1', value: { type: 'text', value: 'Todo' } },
        { pageId: 'row-2', propertyId: 'p1', value: { type: 'text', value: 'Doing' } },
        { pageId: 'row-3', propertyId: 'p1', value: { type: 'text', value: 'todo' } },
      ] as any);

      await service.update(user, { propertyId: 'p1', type: 'select' } as any);

      const patch = propertyRepo.updateProperty.mock.calls[0][0] as any;
      const options = patch.config.options;
      expect(options).toHaveLength(2);
      expect(options.map((o: any) => o.label)).toEqual(['Todo', 'Doing']);
      options.forEach((o: any) => {
        expect(o.id).toEqual(expect.any(String));
        expect(o.color).toEqual(expect.any(String));
      });

      const byLabel = new Map(options.map((o: any) => [o.label, o.id]));
      expect(valueRepo.setValue).toHaveBeenCalledWith({
        pageId: 'row-1',
        propertyId: 'p1',
        value: { type: 'select', value: byLabel.get('Todo') },
      });
      expect(valueRepo.setValue).toHaveBeenCalledWith({
        pageId: 'row-2',
        propertyId: 'p1',
        value: { type: 'select', value: byLabel.get('Doing') },
      });
      // 'todo' maps to the same option as 'Todo'
      expect(valueRepo.setValue).toHaveBeenCalledWith({
        pageId: 'row-3',
        propertyId: 'p1',
        value: { type: 'select', value: byLabel.get('Todo') },
      });
    });

    it('wraps each value in a one-element array on text -> multi_select', async () => {
      propertyRepo.findById
        .mockResolvedValueOnce(textProp)
        .mockResolvedValueOnce({ id: 'p1', type: 'multi_select' } as any);
      databaseRepo.listRows.mockResolvedValue([{ id: 'row-1' }] as any);
      valueRepo.findByPageIds.mockResolvedValue([
        { pageId: 'row-1', propertyId: 'p1', value: { type: 'text', value: 'Todo' } },
      ] as any);

      await service.update(user, {
        propertyId: 'p1',
        type: 'multi_select',
      } as any);

      const patch = propertyRepo.updateProperty.mock.calls[0][0] as any;
      const id = patch.config.options[0].id;
      expect(valueRepo.setValue).toHaveBeenCalledWith({
        pageId: 'row-1',
        propertyId: 'p1',
        value: { type: 'multi_select', value: [id] },
      });
    });

    it('skips blank text rows when deriving options on text -> select', async () => {
      propertyRepo.findById
        .mockResolvedValueOnce(textProp)
        .mockResolvedValueOnce({ id: 'p1', type: 'select' } as any);
      databaseRepo.listRows.mockResolvedValue([
        { id: 'row-1' },
        { id: 'row-2' },
      ] as any);
      valueRepo.findByPageIds.mockResolvedValue([
        { pageId: 'row-1', propertyId: 'p1', value: { type: 'text', value: 'Todo' } },
        { pageId: 'row-2', propertyId: 'p1', value: { type: 'text', value: '   ' } },
      ] as any);

      await service.update(user, { propertyId: 'p1', type: 'select' } as any);

      const patch = propertyRepo.updateProperty.mock.calls[0][0] as any;
      expect(patch.config.options).toHaveLength(1);
      expect(valueRepo.setValue).toHaveBeenCalledTimes(1);
      expect(valueRepo.clearValue).toHaveBeenCalledWith('row-2', 'p1');
    });
  });

  describe('relation (bidirectional)', () => {
    const dbB: any = {
      id: 'db-2',
      pageId: 'dbpage-2',
      spaceId: 'space-1',
      workspaceId: 'ws-1',
    };

    beforeEach(() => {
      databaseRepo.findById.mockImplementation(async (id: string) =>
        id === 'db-1' ? database : id === 'db-2' ? dbB : undefined,
      );
    });

    it('creates a reverse relation in the target db and cross-links both (approval)', async () => {
      // source insert -> reverse insert. Distinguish by databaseId.
      propertyRepo.insertProperty.mockImplementation(async (v: any) => ({
        id: v.databaseId === 'db-1' ? 'src-1' : 'rev-1',
        ...v,
      }));

      const result = await service.create(user, {
        databaseId: 'db-1',
        name: 'Linked',
        type: 'relation',
        config: { targetDatabaseId: 'db-2' },
      } as any);

      // 1) source property inserted with target db-2
      const srcInsert = propertyRepo.insertProperty.mock.calls.find(
        (c: any) => c[0].databaseId === 'db-1',
      )![0] as any;
      expect(srcInsert.type).toBe('relation');
      expect(srcInsert.config.targetDatabaseId).toBe('db-2');

      // 2) reverse property inserted into db-2 pointing back at db-1 + src id
      const revInsert = propertyRepo.insertProperty.mock.calls.find(
        (c: any) => c[0].databaseId === 'db-2',
      )![0] as any;
      expect(revInsert.type).toBe('relation');
      expect(revInsert.config).toEqual({
        targetDatabaseId: 'db-1',
        relatedPropertyId: 'src-1',
      });
      expect(revInsert.position).toEqual(expect.any(String));
      // reverse column is auto-named after the SOURCE db ("Tasks와 관계됨").
      expect(revInsert.name).toBe('Tasks와 관계됨');

      // 3) source config patched with the reverse property id, and the source
      // column is auto-named after the TARGET db ("Projects와 관계됨", #111).
      expect(propertyRepo.updateProperty).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Projects와 관계됨',
          config: { targetDatabaseId: 'db-2', relatedPropertyId: 'rev-1' },
        }),
        'src-1',
      );

      expect(result.id).toBe('src-1');
      expect(result.name).toBe('Projects와 관계됨');
    });

    it('creates two cross-linked columns for a self-relation', async () => {
      let n = 0;
      propertyRepo.insertProperty.mockImplementation(async (v: any) => ({
        id: n++ === 0 ? 'src-1' : 'rev-1',
        ...v,
      }));

      await service.create(user, {
        databaseId: 'db-1',
        name: 'Self',
        type: 'relation',
        config: { targetDatabaseId: 'db-1' },
      } as any);

      // both inserts target db-1
      expect(
        propertyRepo.insertProperty.mock.calls.every(
          (c: any) => c[0].databaseId === 'db-1',
        ),
      ).toBe(true);
      const revInsert = propertyRepo.insertProperty.mock.calls[1][0] as any;
      expect(revInsert.config).toEqual({
        targetDatabaseId: 'db-1',
        relatedPropertyId: 'src-1',
      });
      expect(propertyRepo.updateProperty).toHaveBeenCalledWith(
        expect.objectContaining({
          config: { targetDatabaseId: 'db-1', relatedPropertyId: 'rev-1' },
        }),
        'src-1',
      );
    });

    it('blocks changing a relation property to another type', async () => {
      propertyRepo.findById.mockResolvedValue({
        id: 'src-1',
        databaseId: 'db-1',
        type: 'relation',
        config: { targetDatabaseId: 'db-2', relatedPropertyId: 'rev-1' },
      } as any);

      await expect(
        service.update(user, { propertyId: 'src-1', type: 'text' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(propertyRepo.updateProperty).not.toHaveBeenCalled();
    });

    it('creates a reverse relation when converting text -> relation', async () => {
      propertyRepo.findById
        .mockResolvedValueOnce({
          id: 'src-1',
          databaseId: 'db-1',
          type: 'text',
          config: {},
        } as any)
        .mockResolvedValueOnce({ id: 'src-1', type: 'relation' } as any);
      propertyRepo.insertProperty.mockImplementation(async (v: any) => ({
        id: 'rev-1',
        ...v,
      }));

      await service.update(user, {
        propertyId: 'src-1',
        type: 'relation',
        config: { targetDatabaseId: 'db-2' },
      } as any);

      const revInsert = propertyRepo.insertProperty.mock.calls.find(
        (c: any) => c[0].databaseId === 'db-2',
      )![0] as any;
      expect(revInsert.config).toEqual({
        targetDatabaseId: 'db-1',
        relatedPropertyId: 'src-1',
      });
      expect(propertyRepo.updateProperty).toHaveBeenCalledWith(
        expect.objectContaining({
          config: { targetDatabaseId: 'db-2', relatedPropertyId: 'rev-1' },
        }),
        'src-1',
      );
    });

    it('re-pairs when the relation target changes', async () => {
      propertyRepo.findById
        .mockResolvedValueOnce({
          id: 'src-1',
          databaseId: 'db-1',
          type: 'relation',
          config: { targetDatabaseId: 'db-2', relatedPropertyId: 'rev-old' },
        } as any)
        .mockResolvedValueOnce({ id: 'src-1', type: 'relation' } as any);
      // db-3 is another valid target in the same workspace
      const dbC: any = { ...dbB, id: 'db-3', pageId: 'dbpage-3' };
      databaseRepo.findById.mockImplementation(async (id: string) =>
        id === 'db-1' ? database : id === 'db-3' ? dbC : undefined,
      );
      propertyRepo.insertProperty.mockImplementation(async (v: any) => ({
        id: 'rev-new',
        ...v,
      }));

      await service.update(user, {
        propertyId: 'src-1',
        type: 'relation',
        config: { targetDatabaseId: 'db-3' },
      } as any);

      // old reverse pair soft-deleted
      expect(propertyRepo.softDeleteProperty).toHaveBeenCalledWith('rev-old');
      // new reverse created in db-3
      const revInsert = propertyRepo.insertProperty.mock.calls.find(
        (c: any) => c[0].databaseId === 'db-3',
      )![0] as any;
      expect(revInsert.config).toEqual({
        targetDatabaseId: 'db-1',
        relatedPropertyId: 'src-1',
      });
      expect(propertyRepo.updateProperty).toHaveBeenCalledWith(
        expect.objectContaining({
          config: { targetDatabaseId: 'db-3', relatedPropertyId: 'rev-new' },
        }),
        'src-1',
      );
    });

    it('does not re-pair when target is unchanged', async () => {
      propertyRepo.findById
        .mockResolvedValueOnce({
          id: 'src-1',
          databaseId: 'db-1',
          type: 'relation',
          config: { targetDatabaseId: 'db-2', relatedPropertyId: 'rev-1' },
        } as any)
        .mockResolvedValueOnce({ id: 'src-1', name: 'Renamed' } as any);

      await service.update(user, {
        propertyId: 'src-1',
        name: 'Renamed',
        config: { targetDatabaseId: 'db-2', relatedPropertyId: 'rev-1' },
      } as any);

      expect(propertyRepo.insertProperty).not.toHaveBeenCalled();
      expect(propertyRepo.softDeleteProperty).not.toHaveBeenCalled();
    });

    it('soft-deletes the paired reverse column on delete', async () => {
      propertyRepo.findById.mockResolvedValue({
        id: 'src-1',
        databaseId: 'db-1',
        type: 'relation',
        config: { targetDatabaseId: 'db-2', relatedPropertyId: 'rev-1' },
      } as any);

      await service.delete(user, { propertyId: 'src-1' } as any);

      expect(propertyRepo.softDeleteProperty).toHaveBeenCalledWith('src-1');
      expect(propertyRepo.softDeleteProperty).toHaveBeenCalledWith('rev-1');
    });

    it('rejects creating a second relation to an already-linked target', async () => {
      // db-1 already links db-2; a second relation to db-2 is not allowed.
      propertyRepo.findByDatabaseId.mockResolvedValue([
        {
          id: 'existing',
          databaseId: 'db-1',
          type: 'relation',
          config: { targetDatabaseId: 'db-2' },
        },
      ] as any);

      await expect(
        service.create(user, {
          databaseId: 'db-1',
          name: 'Another',
          type: 'relation',
          config: { targetDatabaseId: 'db-2' },
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      // Rejected before inserting anything (no half-created column).
      expect(propertyRepo.insertProperty).not.toHaveBeenCalled();
    });

    it('rejects redirecting a relation to an already-linked target', async () => {
      const dbC: any = {
        id: 'db-3',
        pageId: 'dbpage-3',
        spaceId: 'space-1',
        workspaceId: 'ws-1',
      };
      databaseRepo.findById.mockImplementation(async (id: string) =>
        id === 'db-1' ? database : id === 'db-2' ? dbB : id === 'db-3' ? dbC : undefined,
      );
      // src-1 → db-2 today; db-1 already has another relation → db-3.
      propertyRepo.findById.mockResolvedValueOnce({
        id: 'src-1',
        databaseId: 'db-1',
        type: 'relation',
        config: { targetDatabaseId: 'db-2', relatedPropertyId: 'rev-1' },
      } as any);
      propertyRepo.findByDatabaseId.mockResolvedValue([
        {
          id: 'src-1',
          databaseId: 'db-1',
          type: 'relation',
          config: { targetDatabaseId: 'db-2', relatedPropertyId: 'rev-1' },
        },
        {
          id: 'other',
          databaseId: 'db-1',
          type: 'relation',
          config: { targetDatabaseId: 'db-3' },
        },
      ] as any);

      await expect(
        service.update(user, {
          propertyId: 'src-1',
          type: 'relation',
          config: { targetDatabaseId: 'db-3' },
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      // Rejected before mutating the column or its pairing.
      expect(propertyRepo.updateProperty).not.toHaveBeenCalled();
      expect(propertyRepo.insertProperty).not.toHaveBeenCalled();
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

  describe('computed system columns are locked (#128)', () => {
    for (const type of ['created_by', 'created_time', 'last_edited_time']) {
      it(`rejects renaming a ${type} column`, async () => {
        propertyRepo.findById.mockResolvedValue({
          id: 'sys-1',
          databaseId: 'db-1',
          type,
          config: {},
        } as any);
        await expect(
          service.update(user, { propertyId: 'sys-1', name: 'X' } as any),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(propertyRepo.updateProperty).not.toHaveBeenCalled();
      });

      it(`rejects deleting a ${type} column`, async () => {
        propertyRepo.findById.mockResolvedValue({
          id: 'sys-1',
          databaseId: 'db-1',
          type,
          config: {},
        } as any);
        await expect(
          service.delete(user, { propertyId: 'sys-1' } as any),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(propertyRepo.softDeleteProperty).not.toHaveBeenCalled();
      });
    }
  });
});
