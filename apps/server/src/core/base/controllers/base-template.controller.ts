import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../../common/decorators/auth-user.decorator';
import { User } from '@docmost/db/types/entity.types';
import { PageAccessService } from '../../page/page-access/page-access.service';
import { BaseService } from '../services/base.service';
import { BaseTemplateService } from '../services/base-template.service';
import {
  CreateTemplateDto,
  PageIdDto,
  TemplateIdDto,
  UpdateTemplateDto,
} from '../dto/base.dto';

@UseGuards(JwtAuthGuard)
@Controller('bases/templates')
export class BaseTemplateController {
  constructor(
    private readonly baseService: BaseService,
    private readonly baseTemplateService: BaseTemplateService,
    private readonly pageAccessService: PageAccessService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  async list(@Body() dto: PageIdDto, @AuthUser() user: User) {
    const page = await this.baseService.findBasePage(dto.pageId);
    await this.pageAccessService.validateCanView(page, user);
    return this.baseTemplateService.list(page);
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(@Body() dto: CreateTemplateDto, @AuthUser() user: User) {
    const page = await this.baseService.findBasePage(dto.pageId);
    await this.pageAccessService.validateCanEdit(page, user);
    return this.baseTemplateService.create(page, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(@Body() dto: UpdateTemplateDto, @AuthUser() user: User) {
    const page = await this.baseService.findBasePage(dto.pageId);
    await this.pageAccessService.validateCanEdit(page, user);
    return this.baseTemplateService.update(page, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async delete(@Body() dto: TemplateIdDto, @AuthUser() user: User) {
    const page = await this.baseService.findBasePage(dto.pageId);
    await this.pageAccessService.validateCanEdit(page, user);
    await this.baseTemplateService.delete(page, dto.templateId);
  }
}
