import {
  registerDecorator,
  isUUID,
  ValidationOptions,
} from 'class-validator';

// Exactly one of `databaseId` / `pageId` must be provided, and the provided one
// must be a UUID. The frontend enters a database through its page (pageId),
// while other callers hold the databaseId directly. A single always-running
// validator enforces both the XOR and the UUID format: `@ValidateIf` /
// `@IsOptional` would short-circuit sibling validators when a field is absent,
// which makes the "neither provided" case impossible to reject.
function DatabaseInfoIdentifier(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'databaseInfoIdentifier',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(_value: unknown, args) {
          const dto = args.object as DatabaseInfoDto;
          const hasDatabaseId = dto.databaseId !== undefined;
          const hasPageId = dto.pageId !== undefined;
          if (hasDatabaseId === hasPageId) return false;
          if (hasDatabaseId) return isUUID(dto.databaseId);
          return isUUID(dto.pageId);
        },
        defaultMessage() {
          return 'exactly one of databaseId or pageId must be provided as a UUID';
        },
      },
    });
  };
}

export class DatabaseInfoDto {
  @DatabaseInfoIdentifier()
  databaseId?: string;

  pageId?: string;
}
