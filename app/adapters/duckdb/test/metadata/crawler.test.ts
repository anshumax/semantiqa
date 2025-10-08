import { describe, expect, it, vi } from 'vitest';

import type { DuckDbAdapter } from '../../src/duckdbAdapter';
import { crawlDuckDbSchema } from '../../src/metadata/crawler';

describe('crawlDuckDbSchema', () => {
  it('produces schema snapshot from information schema queries', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([
        { table_name: 'accounts', table_type: 'BASE TABLE' },
      ])
      .mockResolvedValueOnce([
        { column_name: 'id', data_type: 'INTEGER', is_nullable: 'NO' },
        { column_name: 'name', data_type: 'VARCHAR', is_nullable: 'YES' },
      ]);

    const adapter = {
      query,
    } as unknown as DuckDbAdapter;

    const snapshot = await crawlDuckDbSchema(adapter);

    expect(snapshot.tables).toHaveLength(1);
    const table = snapshot.tables[0];
    expect(table.name).toBe('accounts');
    expect(table.columns[0]).toEqual({ name: 'id', type: 'INTEGER', nullable: false });
  });
});


