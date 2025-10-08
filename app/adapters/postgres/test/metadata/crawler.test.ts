import { describe, expect, it, vi } from 'vitest';

import { crawlSchema } from '../../src/metadata/crawler';

describe('crawlSchema', () => {
  it('maps tables and columns from query results', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              table_schema: 'public',
              table_name: 'accounts',
              table_type: 'BASE TABLE',
              table_comment: 'Account table',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              table_schema: 'public',
              table_name: 'accounts',
              column_name: 'id',
              data_type: 'uuid',
              is_nullable: 'NO',
              column_default: null,
              character_maximum_length: null,
              numeric_precision: null,
              numeric_scale: null,
              column_comment: 'Primary key',
            },
          ],
        }),
      release: vi.fn(),
    };

    const pool = {
      connect: vi.fn().mockResolvedValue(client),
    } as unknown as import('pg').Pool;

    const snapshot = await crawlSchema(pool);

    expect(snapshot.tables).toHaveLength(1);
    const table = snapshot.tables[0];
    expect(table.columns).toHaveLength(1);
    expect(table.columns[0]).toEqual(
      expect.objectContaining({ name: 'id', type: 'uuid', nullable: false }),
    );
  });
});

