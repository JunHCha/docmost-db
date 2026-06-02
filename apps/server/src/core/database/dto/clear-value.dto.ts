import { IsUUID } from 'class-validator';

export class ClearValueDto {
  @IsUUID()
  pageId: string;

  @IsUUID()
  propertyId: string;
}
