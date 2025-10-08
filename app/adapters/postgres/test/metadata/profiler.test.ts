import { describe, expect, it, vi } from 'vitest';

import { profileTables } from '../../src/metadata/profiler';

describe('profileTables', () => {
  it('returns column profile information', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            table_schema: 'public',
            table_name: 'accounts',
            column_name: 'id',
            data_type: 'uuid',
            null_frac: 0,
            n_distinct: 1,
          },
        ],
      }),
      release: vi.fn(),
    };

    const pool = {
      connect: vi.fn().mockResolvedValue(client),
    } as unknown as import('pg').Pool;

    const profiles = await profileTables(pool);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].columns[0].column).toBe('id');
  });
});

