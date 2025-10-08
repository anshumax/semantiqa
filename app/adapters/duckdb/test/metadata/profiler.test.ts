import { describe, expect, it, vi } from 'vitest';

import type { DuckDbAdapter } from '../../src/duckdbAdapter';
import { profileDuckDbTables } from '../../src/metadata/profiler';

describe('profileDuckDbTables', () => {
  it('computes column stats from limited sample', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ table_name: 'accounts' }])
      .mockResolvedValueOnce([{ column_name: 'balance' }])
      .mockResolvedValueOnce([
        {
          sampled_rows: 5,
          null_count: 1,
          distinct_count: 4,
          min_value: 10,
          max_value: 200,
        },
      ]);

    const adapter = {
      query,
    } as unknown as DuckDbAdapter;

    const profiles = await profileDuckDbTables(adapter, { sampleSize: 10 });

    expect(profiles).toHaveLength(1);
    const table = profiles[0];
    expect(table.columns[0]).toEqual(
      expect.objectContaining({ column: 'balance', nullFraction: 0.2, distinctCount: 4 }),
    );
  });
});


