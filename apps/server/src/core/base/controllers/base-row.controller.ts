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
import { BaseRowService } from '../services/base-row.service';
import { serializeRow } from '../base-events';
import { FilterNode } from '../base.types';
import {
  CreateRowDto,
  DeleteRowDto,
  DeleteRowsDto,
  ListRowsDto,
  ReorderRowDto,
  RowInfoDto,
  UpdateRowDto,
} from '../dto/base.dto';

@UseGuards(JwtAuthGuard)
@Controller('bases/rows')
export class BaseRowController {
  constructor(
    private readonly baseService: BaseService,
    private readonly baseRowService: BaseRowService,
    private readonly pageAccessService: PageAccessService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  async list(@Body() dto: ListRowsDto, @AuthUser() user: User) {
    const page = await this.baseService.findBasePage(dto.pageId);
    await this.pageAccessService.validateCanView(page, user);
    const result = await this.baseRowService.list(page, {
      limit: dto.limit,
      cursor: dto.cursor,
      filter: dto.filter as FilterNode | undefined,
      sorts: dto.sorts,
    });
    return {
      items: result.items.map(serializeRow),
      meta: result.meta,
      references: result.references,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  async info(@Body() dto: RowInfoDto, @AuthUser() user: User) {
    const page = await this.baseService.findBasePage(dto.pageId);
    await this.pageAccessService.validateCanView(page, user);
    return serializeRow(await this.baseRowService.info(page, dto.rowId));
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(@Body() dto: CreateRowDto, @AuthUser() user: User) {
    const page = await this.baseService.findBasePage(dto.pageId);
    await this.pageAccessService.validateCanEdit(page, user);
    return serializeRow(await this.baseRowService.create(page, dto, user.id));
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(@Body() dto: UpdateRowDto, @AuthUser() user: User) {
    const page = await this.baseService.findBasePage(dto.pageId);
    await this.pageAccessService.validateCanEdit(page, user);
    return serializeRow(await this.baseRowService.update(page, dto, user.id));
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async delete(@Body() dto: DeleteRowDto, @AuthUser() user: User) {
    const page = await this.baseService.findBasePage(dto.pageId);
    await this.pageAccessService.validateCanEdit(page, user);
    await this.baseRowService.delete(page, {
      rowIds: [dto.rowId],
      requestId: dto.requestId,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete-many')
  async deleteMany(@Body() dto: DeleteRowsDto, @AuthUser() user: User) {
    const page = await this.baseService.findBasePage(dto.pageId);
    await this.pageAccessService.validateCanEdit(page, user);
    await this.baseRowService.delete(page, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('reorder')
  async reorder(@Body() dto: ReorderRowDto, @AuthUser() user: User) {
    const page = await this.baseService.findBasePage(dto.pageId);
    await this.pageAccessService.validateCanEdit(page, user);
    await this.baseRowService.reorder(page, dto, user.id);
  }
}
