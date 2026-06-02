import { IsUUID } from 'class-validator';

export class PropertyIdDto {
  @IsUUID()
  propertyId: string;
}
