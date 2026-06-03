import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DatabaseViewService } from './services/database-view.service';
import { CreateViewDto } from './dto/create-view.dto';
import { UpdateViewDto } from './dto/update-view.dto';
import { ViewIdDto } from './dto/view-id.dto';
import { ListViewsDto } from './dto/list-views.dto';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '@docmost/db/types/entity.types';

@UseGuards(JwtAuthGuard)
@Controller('databases/views')
export class DatabaseViewController {
  constructor(private readonly databaseViewService: DatabaseViewService) {}

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(@Body() dto: CreateViewDto, @AuthUser() user: User) {
    return this.databaseViewService.create(user, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(@Body() dto: UpdateViewDto, @AuthUser() user: User) {
    return this.databaseViewService.update(user, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('list')
  async list(@Body() dto: ListViewsDto, @AuthUser() user: User) {
    return this.databaseViewService.list(user, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('set-default')
  async setDefault(@Body() dto: ViewIdDto, @AuthUser() user: User) {
    return this.databaseViewService.setDefault(user, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async delete(@Body() dto: ViewIdDto, @AuthUser() user: User) {
    return this.databaseViewService.delete(user, dto);
  }
}
