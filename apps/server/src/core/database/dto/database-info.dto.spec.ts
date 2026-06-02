import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { DatabaseInfoDto } from './database-info.dto';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

function validate(payload: Record<string, unknown>) {
  return validateSync(plainToInstance(DatabaseInfoDto, payload));
}

describe('DatabaseInfoDto', () => {
  it('accepts only databaseId', () => {
    expect(validate({ databaseId: UUID_A })).toHaveLength(0);
  });

  it('accepts only pageId', () => {
    expect(validate({ pageId: UUID_A })).toHaveLength(0);
  });

  it('rejects when neither is provided', () => {
    expect(validate({}).length).toBeGreaterThan(0);
  });

  it('rejects when both are provided', () => {
    expect(validate({ databaseId: UUID_A, pageId: UUID_B }).length).toBeGreaterThan(0);
  });

  it('rejects a non-uuid value', () => {
    expect(validate({ databaseId: 'not-a-uuid' }).length).toBeGreaterThan(0);
  });
});
