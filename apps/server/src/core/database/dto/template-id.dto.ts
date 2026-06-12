import { IsUUID } from 'class-validator';

export class TemplateIdDto {
  @IsUUID()
  templateId: string;
}
