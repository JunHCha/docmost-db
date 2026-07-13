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
import { User, Page } from '@docmost/db/types/entity.types';
import { PageAccessService } from '../../page/page-access/page-access.service';
import { BaseService } from '../services/base.service';
import { BaseViewService } from '../services/base-view.service';
import { serializeView } from '../base-events';
import {
  CreateViewDto,
  ListViewsDto,
  UpdateViewDto,
  ViewIdDto,
} from '../dto/base.dto';

@UseGuards(JwtAuthGuard)
@Controller('bases/views')
export class BaseViewController {
  constructor(
    private readonly baseService: BaseService,
    private readonly baseViewService: BaseViewService,
    private readonly pageAccessService: PageAccessService,
  ) {}

  // Personal views only need read access (they belong to the user);
  // shared-view writes need page edit permission.
  private async canEditShared(page: Page, user: User): Promise<boolean> {
    const permissions =
      await this.pageAccessService.validateCanViewWithPermissions(page, user);
    return permissions.canEdit;
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  async list(@Body() dto: ListViewsDto, @AuthUser() user: User) {
    const page = await this.baseService.findBasePage(dto.pageId);
    await this.pageAccessService.validateCanView(page, user);
    const views = await this.baseViewService.list(page, user, {
      embedId: dto.embedId ?? null,
      sourcePageId: dto.sourcePageId ?? null,
    });
    return views.map(serializeView);
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(@Body() dto: CreateViewDto, @AuthUser() user: User) {
    const page = await this.baseService.findBasePage(dto.pageId);
    if (dto.visibility === 'personal') {
      await this.pageAccessService.validateCanView(page, user);
    } else {
      await this.pageAccessService.validateCanEdit(page, user);
    }
    return serializeView(await this.baseViewService.create(page, user, dto));
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(@Body() dto: UpdateViewDto, @AuthUser() user: User) {
    const page = await this.baseService.findBasePage(dto.pageId);
    const canEditShared = await this.canEditShared(page, user);
    return serializeView(
      await this.baseViewService.update(page, user, dto as any, canEditShared),
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async delete(@Body() dto: ViewIdDto, @AuthUser() user: User) {
    const page = await this.baseService.findBasePage(dto.pageId);
    const canEditShared = await this.canEditShared(page, user);
    await this.baseViewService.delete(page, user, dto.viewId, canEditShared);
  }

  @HttpCode(HttpStatus.OK)
  @Post('set-default')
  async setDefault(@Body() dto: ViewIdDto, @AuthUser() user: User) {
    const page = await this.baseService.findBasePage(dto.pageId);
    const canEditShared = await this.canEditShared(page, user);
    return serializeView(
      await this.baseViewService.setDefault(
        page,
        user,
        dto.viewId,
        canEditShared,
      ),
    );
  }
}
