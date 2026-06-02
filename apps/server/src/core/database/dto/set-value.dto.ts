import { IsDefined, IsObject, IsUUID } from 'class-validator';

export class SetValueDto {
  @IsUUID()
  pageId: string;

  @IsUUID()
  propertyId: string;

  // A tagged value object: { type, value }. Validated against the property
  // type in the service (see conventions.md §1).
  @IsDefined()
  @IsObject()
  value: Record<string, unknown>;
}
