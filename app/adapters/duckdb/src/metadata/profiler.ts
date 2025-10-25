import type { DuckDbAdapter } from '../duckdbAdapter';
import { CrawlWarning, AvailableFeatures, EnhancedCrawlResult } from './types';

// Add identifier escaping function
function escapeIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

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
): Promise<EnhancedCrawlResult<DuckDbTableProfile[]>> {
  const warnings: CrawlWarning[] = [];
  const profiles: DuckDbTableProfile[] = [];
  const sampleSize = options.sampleSize ?? DEFAULT_SAMPLE_SIZE;

  const tables = await adapter.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'main'
     ORDER BY table_name`,
  );

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
      try {
        // FIX: Properly escape identifiers
        const escapedColumn = escapeIdentifier(column.column_name);
        const escapedTable = escapeIdentifier(table.table_name);
        
        const stats = await adapter.query<{
          sampled_rows: number;
          null_count: number;
          distinct_count: number;
          min_value: number | string | null;
          max_value: number | string | null;
        }>(
          `SELECT
             COUNT(*) AS sampled_rows,
             SUM(CASE WHEN ${escapedColumn} IS NULL THEN 1 ELSE 0 END) AS null_count,
             COUNT(DISTINCT ${escapedColumn}) AS distinct_count,
             MIN(${escapedColumn}) AS min_value,
             MAX(${escapedColumn}) AS max_value
           FROM (SELECT ${escapedColumn} FROM ${escapedTable} LIMIT ?)`,
          [sampleSize]
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
      } catch (error) {
        warnings.push({
          level: 'warning',
          feature: 'column_profiling',
          message: `Cannot profile ${table.table_name}.${column.column_name}: ${(error as Error).message}`,
          suggestion: 'Check column data type compatibility.'
        });
        
        columnProfiles.push({
          column: column.column_name,
          nullFraction: null,
          distinctCount: null,
          min: null,
          max: null,
        });
      }
    }

    profiles.push({
      name: table.table_name,
      columns: columnProfiles,
      sampledRows: columnProfiles.length > 0 ? columnProfiles[0].distinctCount ?? 0 : 0,
    });
  }

  return {
    data: profiles,
    warnings,
    availableFeatures: {
      hasRowCounts: false,
      hasStatistics: warnings.length === 0,
      hasComments: false,
      hasPermissionErrors: warnings.length > 0,
    },
  };
}


