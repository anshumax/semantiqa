import { describe, expect, it, vi } from 'vitest';

import { profileTables } from '../../src/metadata/profiler';

describe('profileTables', () => {
  it('returns column profile information', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([
        [
          {
            table_schema: 'analytics',
            table_name: 'accounts',
            column_name: 'id',
            data_type: 'char',
          },
        ],
        [],
      ])
      .mockResolvedValueOnce([
        [
          {
            total_rows: 10,
            null_count: 0,
            distinct_count: 10,
            min_value: '0001',
            max_value: '0010',
          },
        ],
        [],
      ]);

    const release = vi.fn();
    const pool = {
      getConnection: vi.fn().mockResolvedValue({ query, release }),
    } as unknown as import('mysql2/promise').Pool;

    const profiles = await profileTables(pool, { sampleSize: 10 });
    expect(profiles).toHaveLength(1);
    expect(profiles[0].columns[0].column).toBe('id');
    expect(profiles[0].columns[0].nullFraction).toBe(0);
    expect(profiles[0].columns[0].distinctFraction).toBe(1);
  });
});


