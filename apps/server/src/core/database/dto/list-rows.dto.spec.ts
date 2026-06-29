import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ListRowsDto } from './list-rows.dto';

const DB_ID = '019e8c50-015a-753f-a546-fa302d039667';

describe('ListRowsDto', () => {
  it('accepts the Title sentinel propertyId in a filter (not a uuid)', async () => {
    const dto = plainToInstance(ListRowsDto, {
      databaseId: DB_ID,
      filters: [{ propertyId: '__title__', op: 'contains', value: 'plan' }],
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts the Title sentinel propertyId in a sort', async () => {
    const dto = plainToInstance(ListRowsDto, {
      databaseId: DB_ID,
      sorts: [{ propertyId: '__title__', direction: 'asc' }],
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('still accepts a real uuid propertyId', async () => {
    const dto = plainToInstance(ListRowsDto, {
      databaseId: DB_ID,
      filters: [{ propertyId: DB_ID, op: 'eq', value: 'x' }],
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a non-string propertyId', async () => {
    const dto = plainToInstance(ListRowsDto, {
      databaseId: DB_ID,
      filters: [{ propertyId: 123, op: 'eq', value: 'x' }],
    });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});
