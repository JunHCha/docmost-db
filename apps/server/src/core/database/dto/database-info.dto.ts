import { IsUUID } from 'class-validator';

export class DatabaseInfoDto {
  @IsUUID()
  databaseId: string;
}
