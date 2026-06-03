import { IsUUID } from 'class-validator';

export class ViewIdDto {
  @IsUUID()
  viewId: string;
}
