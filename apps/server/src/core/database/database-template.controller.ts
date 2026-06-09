import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DatabaseTemplateService } from './services/database-template.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { TemplateIdDto } from './dto/template-id.dto';
import { ListTemplatesDto } from './dto/list-templates.dto';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '@docmost/db/types/entity.types';

@UseGuards(JwtAuthGuard)
@Controller('databases/templates')
export class DatabaseTemplateController {
  constructor(
    private readonly databaseTemplateService: DatabaseTemplateService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(@Body() dto: CreateTemplateDto, @AuthUser() user: User) {
    return this.databaseTemplateService.create(user, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(@Body() dto: UpdateTemplateDto, @AuthUser() user: User) {
    return this.databaseTemplateService.update(user, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('list')
  async list(@Body() dto: ListTemplatesDto, @AuthUser() user: User) {
    return this.databaseTemplateService.list(user, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async delete(@Body() dto: TemplateIdDto, @AuthUser() user: User) {
    return this.databaseTemplateService.delete(user, dto);
  }
}
