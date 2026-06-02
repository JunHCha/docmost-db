import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DatabasePropertyService } from './services/database-property.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { ReorderPropertyDto } from './dto/reorder-property.dto';
import { PropertyIdDto } from './dto/property-id.dto';
import { ListPropertiesDto } from './dto/list-properties.dto';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '@docmost/db/types/entity.types';

@UseGuards(JwtAuthGuard)
@Controller('databases/properties')
export class DatabasePropertyController {
  constructor(
    private readonly databasePropertyService: DatabasePropertyService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(@Body() dto: CreatePropertyDto, @AuthUser() user: User) {
    return this.databasePropertyService.create(user, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(@Body() dto: UpdatePropertyDto, @AuthUser() user: User) {
    return this.databasePropertyService.update(user, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('reorder')
  async reorder(@Body() dto: ReorderPropertyDto, @AuthUser() user: User) {
    return this.databasePropertyService.reorder(user, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async delete(@Body() dto: PropertyIdDto, @AuthUser() user: User) {
    return this.databasePropertyService.delete(user, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('list')
  async list(@Body() dto: ListPropertiesDto, @AuthUser() user: User) {
    return this.databasePropertyService.list(user, dto);
  }
}
