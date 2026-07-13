import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PageAccessService } from '../../page/page-access/page-access.service';
import SpaceAbilityFactory from '../../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../casl/interfaces/space-ability.type';
import { BaseService } from '../services/base.service';
import {
  ConvertBaseDto,
  CreateBaseDto,
  ExpandPagesDto,
  ListBasesDto,
  PageIdDto,
  UpdateBaseDto,
} from '../dto/base.dto';

@UseGuards(JwtAuthGuard)
@Controller('bases')
export class BaseController {
  constructor(
    private readonly baseService: BaseService,
    private readonly pageRepo: PageRepo,
    private readonly pageAccessService: PageAccessService,
    private readonly spaceAbility: SpaceAbilityFactory,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(
    @Body() dto: CreateBaseDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    // The editor's inline-embed path sends parentPageId only; the space
    // path sends spaceId. Resolve the space from the parent when needed.
    const parentPageId = dto.parentPageId ?? dto.pageId;
    let spaceId = dto.spaceId;
    if (!spaceId) {
      if (!parentPageId) {
        throw new NotFoundException('spaceId or parentPageId is required');
      }
      const parent = await this.pageRepo.findById(parentPageId);
      if (!parent || parent.deletedAt) {
        throw new NotFoundException('parent page not found');
      }
      spaceId = parent.spaceId;
    }
    const ability = await this.spaceAbility.createForUser(user, spaceId);
    if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }
    const page = await this.baseService.create(user, workspace, {
      ...dto,
      parentPageId,
      spaceId,
    });
    return this.baseService.info(page, user, {
      canEdit: true,
      hasRestriction: false,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  async info(@Body() dto: PageIdDto, @AuthUser() user: User) {
    const page = await this.baseService.findBasePage(dto.pageId);
    const permissions =
      await this.pageAccessService.validateCanViewWithPermissions(page, user);
    return this.baseService.info(page, user, permissions);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(@Body() dto: UpdateBaseDto, @AuthUser() user: User) {
    const page = await this.baseService.findBasePage(dto.pageId);
    await this.pageAccessService.validateCanEdit(page, user);
    await this.baseService.update(page, dto);
    const updated = await this.baseService.findBasePage(dto.pageId);
    return this.baseService.info(updated, user, {
      canEdit: true,
      hasRestriction: false,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async delete(@Body() dto: PageIdDto, @AuthUser() user: User) {
    const page = await this.baseService.findBasePage(dto.pageId);
    await this.pageAccessService.validateCanEdit(page, user);
    await this.baseService.delete(page, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('convert')
  async convert(@Body() dto: ConvertBaseDto, @AuthUser() user: User) {
    const page = await this.pageRepo.findById(dto.pageId);
    if (!page || page.deletedAt) {
      throw new NotFoundException('page not found');
    }
    await this.pageAccessService.validateCanEdit(page, user);
    const converted = await this.baseService.convert(user, page, dto.template);
    return this.baseService.info(converted, user, {
      canEdit: true,
      hasRestriction: false,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post('export-csv')
  async exportCsv(
    @Body() dto: PageIdDto,
    @AuthUser() user: User,
    @Res() reply: FastifyReply,
  ) {
    const page = await this.baseService.findBasePage(dto.pageId);
    await this.pageAccessService.validateCanView(page, user);
    const { filename, csv } = await this.baseService.exportCsv(page);
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      )
      .send(csv);
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  async list(@Body() dto: ListBasesDto, @AuthUser() user: User) {
    const ability = await this.spaceAbility.createForUser(user, dto.spaceId);
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }
    return this.baseService.listInSpace(dto.spaceId, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('pages/expand')
  async expandPages(
    @Body() dto: ExpandPagesDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.baseService.expandPages(user, workspace, dto.pageIds);
  }
}
