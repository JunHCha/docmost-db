import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { DatabaseTemplateRepo } from '@docmost/db/repos/database/database-template.repo';
import { DatabaseRepo } from '@docmost/db/repos/database/database.repo';
import SpaceAbilityFactory from '../../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../casl/interfaces/space-ability.type';
import {
  Database,
  DatabaseTemplate,
  User,
} from '@docmost/db/types/entity.types';
import { CreateTemplateDto } from '../dto/create-template.dto';
import { UpdateTemplateDto } from '../dto/update-template.dto';
import { TemplateIdDto } from '../dto/template-id.dto';
import { ListTemplatesDto } from '../dto/list-templates.dto';

@Injectable()
export class DatabaseTemplateService {
  constructor(
    private readonly templateRepo: DatabaseTemplateRepo,
    private readonly databaseRepo: DatabaseRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
  ) {}

  async create(user: User, dto: CreateTemplateDto): Promise<DatabaseTemplate> {
    const database = await this.authorize(
      user,
      dto.databaseId,
      SpaceCaslAction.Edit,
    );

    const siblings = await this.templateRepo.findByDatabaseId(dto.databaseId);
    const last = siblings[siblings.length - 1];
    const position = generateJitteredKeyBetween(last?.position ?? null, null);

    return this.templateRepo.create({
      databaseId: dto.databaseId,
      name: dto.name,
      icon: dto.icon ?? null,
      propertyValues: (dto.propertyValues ?? null) as Record<string, any>,
      content: (dto.content ?? null) as Record<string, any>,
      embedViews: (dto.embedViews ?? null) as Record<string, any>,
      position,
      workspaceId: database.workspaceId,
    });
  }

  async list(user: User, dto: ListTemplatesDto): Promise<DatabaseTemplate[]> {
    await this.authorize(user, dto.databaseId, SpaceCaslAction.Read);
    return this.templateRepo.findByDatabaseId(dto.databaseId);
  }

  async update(user: User, dto: UpdateTemplateDto): Promise<DatabaseTemplate> {
    const template = await this.getTemplateForWrite(user, dto.templateId);
    const patch: Record<string, any> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.icon !== undefined) patch.icon = dto.icon;
    if (dto.propertyValues !== undefined)
      patch.propertyValues = dto.propertyValues;
    if (dto.content !== undefined) patch.content = dto.content;
    if (dto.embedViews !== undefined) patch.embedViews = dto.embedViews;
    await this.templateRepo.updateTemplate(patch, template.id);
    return this.templateRepo.findById(template.id);
  }

  async delete(user: User, dto: TemplateIdDto): Promise<void> {
    const template = await this.getTemplateForWrite(user, dto.templateId);
    await this.templateRepo.deleteTemplate(template.id);
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

  private async getTemplateForWrite(
    user: User,
    templateId: string,
  ): Promise<DatabaseTemplate> {
    const template = await this.templateRepo.findById(templateId);
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    await this.authorize(user, template.databaseId, SpaceCaslAction.Edit);
    return template;
  }
}
