import type { DuckDbAdapter } from '../duckdbAdapter';
import type { DuckDbSchemaTable } from './crawler';
import { CrawlWarning } from './types';

function escapeIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function getRowCounts(
  adapter: DuckDbAdapter,
  tables: DuckDbSchemaTable[]
): Promise<{ rowCounts: Map<string, number | null>; warnings: CrawlWarning[] }> {
  const rowCounts = new Map<string, number | null>();
  const warnings: CrawlWarning[] = [];
  
  for (const table of tables) {
    try {
      const escapedTable = escapeIdentifier(table.name);
      const result = await adapter.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM ${escapedTable}`
      );
      rowCounts.set(table.name, result[0]?.count ?? null);
    } catch (error) {
      warnings.push({
        level: 'warning',
        feature: 'row_counts',
        message: `Cannot count rows in ${table.name}: ${(error as Error).message}`,
        suggestion: 'Check table permissions.'
      });
      rowCounts.set(table.name, null);
    }
  }
  
  return { rowCounts, warnings };
}

