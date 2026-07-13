import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BaseTemplate, Page } from '@docmost/db/types/entity.types';
import { BasePropertyRepo } from '@docmost/db/repos/base/base-property.repo';
import { BaseTemplateRepo } from '@docmost/db/repos/base/base-template.repo';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { isReadonlyType, normalizeCellValue } from '../engine/cell-values';

// Fork feature: per-base row templates. A template is a named cell preset
// applied at row creation. Rows are plain base_rows records (no document),
// so templates carry no rich-text content.
@Injectable()
export class BaseTemplateService {
  constructor(
    private readonly baseTemplateRepo: BaseTemplateRepo,
    private readonly basePropertyRepo: BasePropertyRepo,
  ) {}

  async list(page: Page): Promise<BaseTemplate[]> {
    return this.baseTemplateRepo.findByPageId(page.id);
  }

  async create(
    page: Page,
    dto: { name: string; icon?: string; cells?: Record<string, unknown> },
  ): Promise<BaseTemplate> {
    const cells = await this.normalizeCells(page.id, dto.cells ?? {});
    const last = await this.baseTemplateRepo.lastPosition(page.id);
    return this.baseTemplateRepo.insert({
      pageId: page.id,
      name: dto.name,
      icon: dto.icon ?? null,
      cells: cells as any,
      position: generateJitteredKeyBetween(last, null),
      workspaceId: page.workspaceId,
    });
  }

  async update(
    page: Page,
    dto: {
      templateId: string;
      name?: string;
      icon?: string | null;
      cells?: Record<string, unknown>;
      position?: string;
    },
  ): Promise<BaseTemplate> {
    const template = await this.find(page, dto.templateId);
    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.icon !== undefined) patch.icon = dto.icon;
    if (dto.position !== undefined) patch.position = dto.position;
    if (dto.cells !== undefined) {
      patch.cells = (await this.normalizeCells(page.id, dto.cells)) as any;
    }
    return this.baseTemplateRepo.update(template.id, patch);
  }

  async delete(page: Page, templateId: string): Promise<void> {
    const template = await this.find(page, templateId);
    await this.baseTemplateRepo.delete(template.id);
  }

  private async find(page: Page, templateId: string): Promise<BaseTemplate> {
    const template = await this.baseTemplateRepo.findById(templateId);
    if (!template || template.pageId !== page.id) {
      throw new NotFoundException('template not found');
    }
    return template;
  }

  private async normalizeCells(
    pageId: string,
    cells: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const properties = await this.basePropertyRepo.findLiveByPageId(pageId);
    const map = new Map(properties.map((p) => [p.id, p]));
    const normalized: Record<string, unknown> = {};
    for (const [propertyId, raw] of Object.entries(cells)) {
      const property = map.get(propertyId);
      if (!property) {
        throw new BadRequestException(`unknown property: ${propertyId}`);
      }
      if (isReadonlyType(property.type)) {
        throw new BadRequestException(
          `${property.type} cells cannot be templated`,
        );
      }
      const value = normalizeCellValue(property, raw);
      if (value !== null) normalized[propertyId] = value;
    }
    return normalized;
  }
}
