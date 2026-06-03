import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { DatabaseInfoDto } from './database-info.dto';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

// Mirror the global pipe (main.ts) so the test catches whitelist stripping:
// a property without any validation decorator is removed before the custom
// XOR validator runs.
const pipe = new ValidationPipe({ whitelist: true, transform: true });

function transform(payload: Record<string, unknown>) {
  return pipe.transform(payload, { type: 'body', metatype: DatabaseInfoDto });
}

describe('DatabaseInfoDto (via ValidationPipe)', () => {
  it('accepts only databaseId', async () => {
    const result = await transform({ databaseId: UUID_A });
    expect(result.databaseId).toBe(UUID_A);
  });

  it('accepts only pageId and keeps it (not stripped by whitelist)', async () => {
    const result = await transform({ pageId: UUID_A });
    expect(result.pageId).toBe(UUID_A);
  });

  it('rejects when neither is provided', async () => {
    await expect(transform({})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when both are provided', async () => {
    await expect(
      transform({ databaseId: UUID_A, pageId: UUID_B }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a non-uuid databaseId', async () => {
    await expect(
      transform({ databaseId: 'not-a-uuid' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a non-uuid pageId', async () => {
    await expect(transform({ pageId: 'not-a-uuid' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
