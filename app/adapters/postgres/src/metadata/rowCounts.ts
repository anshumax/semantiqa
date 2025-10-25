import type { PostgresAdapter } from '../postgresAdapter';
import type { SchemaTable } from './crawler';
import { CrawlWarning } from './types';

export async function getRowCounts(
  adapter: PostgresAdapter,
  tables: SchemaTable[]
): Promise<{ rowCounts: Map<string, number | null>; warnings: CrawlWarning[] }> {
  const rowCounts = new Map<string, number | null>();
  const warnings: CrawlWarning[] = [];
  let failedStats = false;
  let failedClass = false;

  const client = await adapter.getPool().connect();
  
  try {
    for (const table of tables) {
      const key = `${table.schema}.${table.name}`;
      
      // Strategy 1: pg_stat_user_tables (accurate)
      if (!failedStats) {
        try {
          const result = await client.query(
            `SELECT n_live_tup FROM pg_stat_user_tables 
             WHERE schemaname = $1 AND relname = $2`,
            [table.schema, table.name]
          );
          if (result.rows[0]?.n_live_tup != null) {
            rowCounts.set(key, result.rows[0].n_live_tup);
            continue;
          }
        } catch (e) {
          failedStats = true;
          warnings.push({
            level: 'info',
            feature: 'pg_stat_user_tables',
            message: 'Cannot access pg_stat_user_tables. Row counts unavailable.',
            suggestion: 'Grant SELECT on pg_stat_user_tables for accurate counts.'
          });
        }
      }
      
      // Strategy 2: pg_class.reltuples (estimate)
      if (!failedClass) {
        try {
          const result = await client.query(
            `SELECT reltuples::bigint FROM pg_class 
             WHERE relname = $1 AND relnamespace = $2::regnamespace`,
            [table.name, table.schema]
          );
          if (result.rows[0]?.reltuples != null) {
            rowCounts.set(key, result.rows[0].reltuples);
            continue;
          }
        } catch (e) {
          failedClass = true;
        }
      }
      
      // Strategy 3: null (unavailable)
      rowCounts.set(key, null);
    }
  } finally {
    client.release();
  }
  
  return { rowCounts, warnings };
}

