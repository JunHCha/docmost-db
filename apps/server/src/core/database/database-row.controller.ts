import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DatabaseRowService } from './services/database-row.service';
import { CreateRowDto } from './dto/create-row.dto';
import { ListRowsDto } from './dto/list-rows.dto';
import { SetValueDto } from './dto/set-value.dto';
import { ClearValueDto } from './dto/clear-value.dto';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User, Workspace } from '@docmost/db/types/entity.types';

@UseGuards(JwtAuthGuard)
@Controller('databases')
export class DatabaseRowController {
  constructor(private readonly databaseRowService: DatabaseRowService) {}

  @HttpCode(HttpStatus.OK)
  @Post('rows/create')
  async createRow(
    @Body() dto: CreateRowDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.databaseRowService.createRow(user, workspace, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('rows/list')
  async listRows(@Body() dto: ListRowsDto, @AuthUser() user: User) {
    return this.databaseRowService.listRows(user, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('values/set')
  async setValue(@Body() dto: SetValueDto, @AuthUser() user: User) {
    return this.databaseRowService.setValue(user, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('values/clear')
  async clearValue(@Body() dto: ClearValueDto, @AuthUser() user: User) {
    return this.databaseRowService.clearValue(user, dto);
  }
}
