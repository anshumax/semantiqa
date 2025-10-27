import type { DuckDbAdapter } from '../duckdbAdapter';
import type { CrawlWarning } from './types';
import { z } from 'zod';

export interface ForeignKeyConstraint {
  constraintName: string;
  sourceSchema: string;
  sourceTable: string;
  sourceColumn: string;
  targetSchema: string;
  targetTable: string;
  targetColumn: string;
}

const ForeignKeyRowSchema = z.object({
  constraint_name: z.string(),
  table_schema: z.string(),
  table_name: z.string(),
  column_name: z.string(),
  foreign_table_schema: z.string(),
  foreign_table_name: z.string(),
  foreign_column_name: z.string(),
});

type ForeignKeyRow = z.infer<typeof ForeignKeyRowSchema>;

// Tier 1: Full information_schema access (DuckDB supports similar schema to Postgres)
const TIER1_FK_QUERY = `
SELECT
  tc.constraint_name,
  kcu.table_schema,
  kcu.table_name,
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'main'
ORDER BY tc.table_name, kcu.ordinal_position
`;

function parseResults(rows: unknown[]): ForeignKeyConstraint[] {
  const results: ForeignKeyConstraint[] = [];
  
  for (const row of rows) {
    try {
      const parsed = ForeignKeyRowSchema.parse(row);
      results.push({
        constraintName: parsed.constraint_name,
        sourceSchema: parsed.table_schema,
        sourceTable: parsed.table_name,
        sourceColumn: parsed.column_name,
        targetSchema: parsed.foreign_table_schema,
        targetTable: parsed.foreign_table_name,
        targetColumn: parsed.foreign_column_name,
      });
    } catch (error) {
      // Skip malformed rows
      console.warn('Failed to parse FK row:', error);
    }
  }
  
  return results;
}

/**
 * Discover foreign key constraints with graceful degradation.
 * Tries multiple access tiers and accumulates all discovered FKs.
 */
export async function getForeignKeys(
  adapter: DuckDbAdapter
): Promise<{ foreignKeys: ForeignKeyConstraint[], warnings: CrawlWarning[] }> {
  const discovered: ForeignKeyConstraint[] = [];
  const warnings: CrawlWarning[] = [];
  
  try {
    // Tier 1: information_schema access
    try {
      const rows = await adapter.query(TIER1_FK_QUERY);
      const fks = parseResults(rows);
      discovered.push(...fks);
      
      if (fks.length > 0) {
        console.log(`✓ Discovered ${fks.length} foreign key constraints`);
      }
    } catch (error) {
      warnings.push({
        level: 'info',
        feature: 'foreign_keys',
        message: 'No FK discovery access available or FKs not supported.',
        suggestion: 'DuckDB foreign keys may not be available in all versions.'
      });
    }
  } catch (error) {
    warnings.push({
      level: 'error',
      feature: 'foreign_keys',
      message: `FK discovery failed: ${(error as Error).message}`,
    });
  }
  
  return { foreignKeys: discovered, warnings };
}

