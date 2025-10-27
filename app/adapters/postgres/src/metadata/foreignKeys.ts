import type { PostgresAdapter } from '../postgresAdapter';
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

// Tier 1: Full information_schema access with all FK metadata
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
  AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY tc.table_schema, tc.table_name, kcu.ordinal_position
`;

// Tier 2: Basic KEY_COLUMN_USAGE only (fallback)
const TIER2_FK_QUERY = `
SELECT
  kcu.constraint_name,
  kcu.table_schema,
  kcu.table_name,
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.key_column_usage AS kcu
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = kcu.constraint_name
  AND ccu.table_schema = kcu.table_schema
WHERE kcu.table_schema NOT IN ('pg_catalog', 'information_schema')
  AND EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    WHERE tc.constraint_name = kcu.constraint_name
      AND tc.constraint_type = 'FOREIGN KEY'
  )
ORDER BY kcu.table_schema, kcu.table_name, kcu.ordinal_position
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
  adapter: PostgresAdapter
): Promise<{ foreignKeys: ForeignKeyConstraint[], warnings: CrawlWarning[] }> {
  const discovered: ForeignKeyConstraint[] = [];
  const warnings: CrawlWarning[] = [];
  
  const client = await adapter.getPool().connect();
  try {
    // Tier 1: Full information_schema access
    try {
      const result = await client.query(TIER1_FK_QUERY);
      const fks = parseResults(result.rows);
      discovered.push(...fks);
      
      if (fks.length > 0) {
        console.log(`✓ Discovered ${fks.length} foreign key constraints (Tier 1)`);
      }
    } catch (error) {
      warnings.push({
        level: 'warning',
        feature: 'foreign_keys_tier1',
        message: 'Cannot access full FK metadata. Trying fallback.',
        suggestion: 'Grant SELECT on information_schema.table_constraints for complete FK discovery.'
      });
      
      // Tier 2: Basic KEY_COLUMN_USAGE only
      try {
        const result = await client.query(TIER2_FK_QUERY);
        const fks = parseResults(result.rows);
        discovered.push(...fks);
        
        if (fks.length > 0) {
          console.log(`✓ Discovered ${fks.length} foreign key constraints (Tier 2 fallback)`);
        }
      } catch (error2) {
        warnings.push({
          level: 'info',
          feature: 'foreign_keys',
          message: 'No FK discovery access available.',
          suggestion: 'Foreign keys must be manually documented or grant SELECT on information_schema.'
        });
      }
    }
  } finally {
    client.release();
  }
  
  return { foreignKeys: discovered, warnings };
}

