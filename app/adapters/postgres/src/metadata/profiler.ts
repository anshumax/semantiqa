import type { PostgresAdapter } from '../postgresAdapter';
import { CrawlWarning, AvailableFeatures, EnhancedCrawlResult } from './types';

export interface ColumnProfile {
  column: string;
  nullFraction: number;
  distinctFraction: number | null;
  min?: string | number | null;
  max?: string | number | null;
}

export interface TableProfile {
  schema: string;
  name: string;
  columns: ColumnProfile[];
  sampledRows: number;
}

const PROFILE_QUERY = `
SELECT
  table_schema,
  table_name,
  column_name,
  data_type,
  pg_stats.null_frac,
  pg_stats.avg_width,
  pg_stats.n_distinct
FROM pg_stats
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name, column_name;
`;

export async function profileTables(postgresAdapter: PostgresAdapter): Promise<EnhancedCrawlResult<TableProfile[]>> {
  const warnings: CrawlWarning[] = [];
  let profiles: TableProfile[] = [];
  
  const client = await postgresAdapter.getPool().connect();
  
  try {
    const result = await client.query(PROFILE_QUERY);
    const tables = new Map<string, TableProfile>();

    for (const row of result.rows) {
      const key = `${row.table_schema}.${row.table_name}`;
      if (!tables.has(key)) {
        tables.set(key, {
          schema: row.table_schema,
          name: row.table_name,
          columns: [],
          sampledRows: 0,
        });
      }

      const table = tables.get(key)!;
      table.columns.push({
        column: row.column_name,
        nullFraction: Number(row.null_frac ?? 0),
        distinctFraction: typeof row.n_distinct === 'number' ? row.n_distinct : null,
      });
    }

    profiles = Array.from(tables.values());
  } catch (error) {
    warnings.push({
      level: 'warning',
      feature: 'pg_stats',
      message: 'Cannot access pg_stats view. Column statistics unavailable.',
      suggestion: 'Grant SELECT on pg_stats or run ANALYZE on tables.'
    });
  } finally {
    client.release();
  }
  
  return {
    data: profiles,
    warnings,
    availableFeatures: {
      hasRowCounts: false,
      hasStatistics: profiles.length > 0,
      hasComments: false,
      hasPermissionErrors: warnings.length > 0,
    },
  };
}

