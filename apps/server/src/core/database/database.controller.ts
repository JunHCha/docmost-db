import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DatabaseService } from './services/database.service';
import { CreateDatabaseDto } from './dto/create-database.dto';
import { DatabaseInfoDto } from './dto/database-info.dto';
import { ListDatabasesDto } from './dto/list-databases.dto';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User, Workspace } from '@docmost/db/types/entity.types';

@UseGuards(JwtAuthGuard)
@Controller('databases')
export class DatabaseController {
  constructor(private readonly databaseService: DatabaseService) {}

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(
    @Body() dto: CreateDatabaseDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.databaseService.create(user, workspace, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  async info(@Body() dto: DatabaseInfoDto, @AuthUser() user: User) {
    return this.databaseService.info(user, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('list')
  async list(@Body() dto: ListDatabasesDto, @AuthUser() user: User) {
    return this.databaseService.list(user, dto);
  }
}
