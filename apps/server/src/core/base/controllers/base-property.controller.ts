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
import { BasePropertyService } from '../services/base-property.service';
import { serializeProperty } from '../base-events';
import {
  CreatePropertyDto,
  DeletePropertyDto,
  ReorderPropertyDto,
  UpdatePropertyDto,
} from '../dto/base.dto';

@UseGuards(JwtAuthGuard)
@Controller('bases/properties')
export class BasePropertyController {
  constructor(
    private readonly baseService: BaseService,
    private readonly basePropertyService: BasePropertyService,
    private readonly pageAccessService: PageAccessService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(@Body() dto: CreatePropertyDto, @AuthUser() user: User) {
    const page = await this.baseService.findBasePage(dto.pageId);
    await this.pageAccessService.validateCanEdit(page, user);
    return serializeProperty(
      await this.basePropertyService.create(page, dto, user.id),
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(@Body() dto: UpdatePropertyDto, @AuthUser() user: User) {
    const page = await this.baseService.findBasePage(dto.pageId);
    await this.pageAccessService.validateCanEdit(page, user);
    const { property, jobId } = await this.basePropertyService.update(
      page,
      dto,
    );
    return { property: serializeProperty(property), jobId };
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async delete(@Body() dto: DeletePropertyDto, @AuthUser() user: User) {
    const page = await this.baseService.findBasePage(dto.pageId);
    await this.pageAccessService.validateCanEdit(page, user);
    await this.basePropertyService.delete(page, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('reorder')
  async reorder(@Body() dto: ReorderPropertyDto, @AuthUser() user: User) {
    const page = await this.baseService.findBasePage(dto.pageId);
    await this.pageAccessService.validateCanEdit(page, user);
    await this.basePropertyService.reorder(page, dto);
  }
}
