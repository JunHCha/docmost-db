import { IsUUID } from 'class-validator';

export class ListDatabasesDto {
  @IsUUID()
  spaceId: string;
}
