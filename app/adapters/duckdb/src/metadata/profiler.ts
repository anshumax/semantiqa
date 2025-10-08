import type { DuckDbAdapter } from '../duckdbAdapter';

export interface DuckDbColumnProfile {
  column: string;
  nullFraction: number | null;
  distinctCount: number | null;
  min?: number | string | null;
  max?: number | string | null;
}

export interface DuckDbTableProfile {
  name: string;
  columns: DuckDbColumnProfile[];
  sampledRows: number;
}

export interface DuckDbProfilerOptions {
  sampleSize?: number;
}

const DEFAULT_SAMPLE_SIZE = 1_000;

export async function profileDuckDbTables(
  adapter: DuckDbAdapter,
  options: DuckDbProfilerOptions = {},
): Promise<DuckDbTableProfile[]> {
  const sampleSize = options.sampleSize ?? DEFAULT_SAMPLE_SIZE;

  const tables = await adapter.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'main'
     ORDER BY table_name`,
  );

  const profiles: DuckDbTableProfile[] = [];

  for (const table of tables) {
    const columns = await adapter.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'main' AND table_name = ?
       ORDER BY ordinal_position`,
      [table.table_name],
    );

    const columnProfiles: DuckDbColumnProfile[] = [];

    for (const column of columns) {
      const stats = await adapter.query<{
        sampled_rows: number;
        null_count: number;
        distinct_count: number;
        min_value: number | string | null;
        max_value: number | string | null;
      }>(
        `SELECT
           COUNT(*) AS sampled_rows,
           SUM(CASE WHEN ${column.column_name} IS NULL THEN 1 ELSE 0 END) AS null_count,
           COUNT(DISTINCT ${column.column_name}) AS distinct_count,
           MIN(${column.column_name}) AS min_value,
           MAX(${column.column_name}) AS max_value
         FROM (SELECT ${column.column_name} FROM ${table.table_name} LIMIT ${sampleSize})`,
      );

      const { sampled_rows, null_count, distinct_count, min_value, max_value } = stats[0] ?? {
        sampled_rows: 0,
        null_count: 0,
        distinct_count: 0,
        min_value: null,
        max_value: null,
      };

      columnProfiles.push({
        column: column.column_name,
        nullFraction: sampled_rows > 0 ? null_count / sampled_rows : null,
        distinctCount: sampled_rows > 0 ? distinct_count : null,
        min: min_value,
        max: max_value,
      });
    }

    profiles.push({
      name: table.table_name,
      columns: columnProfiles,
      sampledRows: columnProfiles.length > 0 ? columnProfiles[0].distinctCount ?? 0 : 0,
    });
  }

  return profiles;
}


