import { describe, expect, it, vi } from 'vitest';

import { crawlSchema } from '../../src/metadata/crawler';

describe('crawlSchema', () => {
  it('maps tables and columns from query results', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([
        [
          {
            table_schema: 'analytics',
            table_name: 'accounts',
            table_type: 'BASE TABLE',
            table_comment: 'Account table',
          },
        ],
        [],
      ])
      .mockResolvedValueOnce([
        [
          {
            table_schema: 'analytics',
            table_name: 'accounts',
            column_name: 'id',
            data_type: 'char',
            is_nullable: 'NO',
            column_default: null,
            character_maximum_length: null,
            numeric_precision: null,
            numeric_scale: null,
            column_comment: 'Primary key',
          },
        ],
        [],
      ]);

    const release = vi.fn();
    const pool = {
      getConnection: vi.fn().mockResolvedValue({ query, release }),
    } as unknown as import('mysql2/promise').Pool;

    const snapshot = await crawlSchema(pool);

    expect(snapshot.tables).toHaveLength(1);
    const table = snapshot.tables[0];
    expect(table.columns).toHaveLength(1);
    expect(table.columns[0]).toEqual(
      expect.objectContaining({ name: 'id', type: 'char', nullable: false }),
    );
  });
});


