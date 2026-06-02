import { IsOptional, IsUUID } from 'class-validator';

export class ReorderPropertyDto {
  @IsUUID()
  propertyId: string;

  // Place the property immediately after this sibling. Omit to move to the front.
  @IsOptional()
  @IsUUID()
  afterPropertyId?: string;
}
