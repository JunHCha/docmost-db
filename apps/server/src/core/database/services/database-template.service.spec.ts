import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DatabaseTemplateService } from './database-template.service';
import { DatabaseTemplateRepo } from '@docmost/db/repos/database/database-template.repo';
import { DatabaseRepo } from '@docmost/db/repos/database/database.repo';
import { KYSELY_MODULE_CONNECTION_TOKEN } from 'nestjs-kysely';
import SpaceAbilityFactory from '../../casl/abilities/space-ability.factory';
import { SpaceCaslAction } from '../../casl/interfaces/space-ability.type';

const user: any = { id: 'user-1' };
const database: any = {
  id: 'db-1',
  pageId: 'dbpage-1',
  spaceId: 'space-1',
  workspaceId: 'ws-1',
};

// ability that allows `actions` (and nothing else). Read < Edit.
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

describe('DatabaseTemplateService', () => {
  let service: DatabaseTemplateService;
  let templateRepo: jest.Mocked<
    Pick<
      DatabaseTemplateRepo,
      | 'findById'
      | 'findByDatabaseId'
      | 'create'
      | 'updateTemplate'
      | 'deleteTemplate'
    >
  >;
  let databaseRepo: jest.Mocked<Pick<DatabaseRepo, 'findById'>>;
  let spaceAbility: jest.Mocked<Pick<SpaceAbilityFactory, 'createForUser'>>;

  beforeEach(async () => {
    templateRepo = {
      findById: jest.fn(),
      findByDatabaseId: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((v) => ({ id: 't-new', ...v })),
      updateTemplate: jest.fn(),
      deleteTemplate: jest.fn(),
    } as any;
    databaseRepo = {
      findById: jest.fn().mockResolvedValue(database),
    } as any;
    spaceAbility = {
      createForUser: jest.fn().mockResolvedValue(abilityMock(true)),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseTemplateService,
        { provide: DatabaseTemplateRepo, useValue: templateRepo },
        { provide: DatabaseRepo, useValue: databaseRepo },
        { provide: SpaceAbilityFactory, useValue: spaceAbility },
        { provide: KYSELY_MODULE_CONNECTION_TOKEN(), useValue: {} },
      ],
    }).compile();

    service = module.get<DatabaseTemplateService>(DatabaseTemplateService);
  });

  describe('create', () => {
    it('appends a template with a generated position', async () => {
      templateRepo.findByDatabaseId.mockResolvedValue([]);
      const result = await service.create(user, {
        databaseId: 'db-1',
        name: 'Bug report',
        icon: '🐛',
        propertyValues: { 'prop-1': { type: 'text', value: 'x' } },
        content: { type: 'doc', content: [] },
      } as any);
      expect(spaceAbility.createForUser).toHaveBeenCalledWith(user, 'space-1');
      expect(templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          databaseId: 'db-1',
          name: 'Bug report',
          icon: '🐛',
          workspaceId: 'ws-1',
          propertyValues: { 'prop-1': { type: 'text', value: 'x' } },
          content: { type: 'doc', content: [] },
          position: expect.any(String),
        }),
      );
      expect(result.id).toBe('t-new');
    });

    it('persists embedViews when provided', async () => {
      templateRepo.findByDatabaseId.mockResolvedValue([]);
      const embedViews = {
        'embed-1': [{ name: 'Tasks', type: 'table', config: { filters: [] } }],
      };
      await service.create(user, {
        databaseId: 'db-1',
        name: 'Project',
        embedViews,
      } as any);
      expect(templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ embedViews }),
      );
    });

    it('persists embedViews as null when omitted', async () => {
      templateRepo.findByDatabaseId.mockResolvedValue([]);
      await service.create(user, { databaseId: 'db-1', name: 'x' } as any);
      expect(templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ embedViews: null }),
      );
    });

    it('orders a new template after the last existing one', async () => {
      templateRepo.findByDatabaseId.mockResolvedValue([
        { id: 't1', position: 'a0' } as any,
      ]);
      await service.create(user, { databaseId: 'db-1', name: 'Second' } as any);
      const arg = templateRepo.create.mock.calls[0][0];
      expect(arg.position > 'a0').toBe(true);
    });

    it('throws Forbidden without edit permission', async () => {
      spaceAbility.createForUser.mockResolvedValue(
        abilityFor([SpaceCaslAction.Read]) as any,
      );
      await expect(
        service.create(user, { databaseId: 'db-1', name: 'x' } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(templateRepo.create).not.toHaveBeenCalled();
    });

    it('throws NotFound when the database is missing', async () => {
      databaseRepo.findById.mockResolvedValue(undefined);
      await expect(
        service.create(user, { databaseId: 'missing', name: 'x' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('list', () => {
    it('returns the database templates with only Read', async () => {
      spaceAbility.createForUser.mockResolvedValue(
        abilityFor([SpaceCaslAction.Read]) as any,
      );
      const templates: any = [{ id: 't1' }, { id: 't2' }];
      templateRepo.findByDatabaseId.mockResolvedValue(templates);
      const result = await service.list(user, { databaseId: 'db-1' } as any);
      expect(templateRepo.findByDatabaseId).toHaveBeenCalledWith('db-1');
      expect(result).toBe(templates);
    });

    it('throws NotFound when the database is missing', async () => {
      databaseRepo.findById.mockResolvedValue(undefined);
      await expect(
        service.list(user, { databaseId: 'missing' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('patches name, icon, propertyValues and content', async () => {
      templateRepo.findById
        .mockResolvedValueOnce({ id: 't1', databaseId: 'db-1' } as any)
        .mockResolvedValueOnce({ id: 't1', name: 'Renamed' } as any);
      const result = await service.update(user, {
        templateId: 't1',
        name: 'Renamed',
        icon: '📝',
        propertyValues: { 'p-1': { type: 'checkbox', value: true } },
        content: { type: 'doc', content: [] },
      } as any);
      expect(templateRepo.updateTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Renamed',
          icon: '📝',
          propertyValues: { 'p-1': { type: 'checkbox', value: true } },
          content: { type: 'doc', content: [] },
        }),
        't1',
      );
      expect(result).toEqual({ id: 't1', name: 'Renamed' });
    });

    it('patches embedViews when provided', async () => {
      templateRepo.findById
        .mockResolvedValueOnce({ id: 't1', databaseId: 'db-1' } as any)
        .mockResolvedValueOnce({ id: 't1' } as any);
      const embedViews = { 'embed-1': [{ name: 'T', type: 'table', config: {} }] };
      await service.update(user, { templateId: 't1', embedViews } as any);
      expect(templateRepo.updateTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ embedViews }),
        't1',
      );
    });

    it('does not touch embedViews when omitted', async () => {
      templateRepo.findById
        .mockResolvedValueOnce({ id: 't1', databaseId: 'db-1' } as any)
        .mockResolvedValueOnce({ id: 't1' } as any);
      await service.update(user, { templateId: 't1', name: 'x' } as any);
      const patch = templateRepo.updateTemplate.mock.calls[0][0];
      expect('embedViews' in patch).toBe(false);
    });

    it('forbids updating without Edit', async () => {
      spaceAbility.createForUser.mockResolvedValue(
        abilityFor([SpaceCaslAction.Read]) as any,
      );
      templateRepo.findById.mockResolvedValue({
        id: 't1',
        databaseId: 'db-1',
      } as any);
      await expect(
        service.update(user, { templateId: 't1', name: 'x' } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(templateRepo.updateTemplate).not.toHaveBeenCalled();
    });

    it('throws NotFound for a missing template', async () => {
      templateRepo.findById.mockResolvedValue(undefined);
      await expect(
        service.update(user, { templateId: 'gone' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes a template', async () => {
      templateRepo.findById.mockResolvedValue({
        id: 't1',
        databaseId: 'db-1',
      } as any);
      await service.delete(user, { templateId: 't1' } as any);
      expect(templateRepo.deleteTemplate).toHaveBeenCalledWith('t1');
    });

    it('forbids deleting without Edit', async () => {
      spaceAbility.createForUser.mockResolvedValue(
        abilityFor([SpaceCaslAction.Read]) as any,
      );
      templateRepo.findById.mockResolvedValue({
        id: 't1',
        databaseId: 'db-1',
      } as any);
      await expect(
        service.delete(user, { templateId: 't1' } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(templateRepo.deleteTemplate).not.toHaveBeenCalled();
    });

    it('throws NotFound for a missing template', async () => {
      templateRepo.findById.mockResolvedValue(undefined);
      await expect(
        service.delete(user, { templateId: 'gone' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
