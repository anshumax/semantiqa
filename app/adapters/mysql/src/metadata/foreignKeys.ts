import type { MysqlAdapter } from '../mysqlAdapter';
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
  referenced_table_schema: z.string().nullable(),
  referenced_table_name: z.string().nullable(),
  referenced_column_name: z.string().nullable(),
});

type ForeignKeyRow = z.infer<typeof ForeignKeyRowSchema>;

// Tier 1: Full information_schema.key_column_usage access
// Use explicit aliases to ensure consistent column naming across MySQL versions
const TIER1_FK_QUERY = `
SELECT
  kcu.CONSTRAINT_NAME as constraint_name,
  kcu.TABLE_SCHEMA as table_schema,
  kcu.TABLE_NAME as table_name,
  kcu.COLUMN_NAME as column_name,
  kcu.REFERENCED_TABLE_SCHEMA as referenced_table_schema,
  kcu.REFERENCED_TABLE_NAME as referenced_table_name,
  kcu.REFERENCED_COLUMN_NAME as referenced_column_name
FROM information_schema.key_column_usage kcu
WHERE kcu.REFERENCED_TABLE_NAME IS NOT NULL
  AND kcu.TABLE_SCHEMA = DATABASE()
ORDER BY kcu.TABLE_NAME, kcu.ORDINAL_POSITION
`;

function parseResults(rows: unknown[]): ForeignKeyConstraint[] {
  const results: ForeignKeyConstraint[] = [];
  
  for (const row of rows) {
    try {
      const parsed = ForeignKeyRowSchema.parse(row);
      
      // Skip rows without complete FK information
      if (!parsed.referenced_table_schema || !parsed.referenced_table_name || !parsed.referenced_column_name) {
        continue;
      }
      
      results.push({
        constraintName: parsed.constraint_name,
        sourceSchema: parsed.table_schema,
        sourceTable: parsed.table_name,
        sourceColumn: parsed.column_name,
        targetSchema: parsed.referenced_table_schema,
        targetTable: parsed.referenced_table_name,
        targetColumn: parsed.referenced_column_name,
      });
    } catch (error) {
      // Log the actual row data to debug
      console.warn('Failed to parse FK row. Raw row data:', JSON.stringify(row));
      console.warn('Parse error:', error);
    }
  }
  
  return results;
}

/**
 * Discover foreign key constraints with graceful degradation.
 * Tries multiple access tiers and accumulates all discovered FKs.
 */
export async function getForeignKeys(
  adapter: MysqlAdapter
): Promise<{ foreignKeys: ForeignKeyConstraint[], warnings: CrawlWarning[] }> {
  const discovered: ForeignKeyConstraint[] = [];
  const warnings: CrawlWarning[] = [];
  
  const connection = await adapter.getPool().getConnection();
  try {
    // Tier 1: information_schema.key_column_usage
    try {
      const [rows] = await connection.query(TIER1_FK_QUERY);
      const fks = parseResults(rows as unknown[]);
      discovered.push(...fks);
      
      if (fks.length > 0) {
        console.log(`✓ Discovered ${fks.length} foreign key constraints`);
      }
    } catch (error) {
      warnings.push({
        level: 'info',
        feature: 'foreign_keys',
        message: 'No FK discovery access available.',
        suggestion: 'Foreign keys must be manually documented or grant SELECT on information_schema.'
      });
    }
  } finally {
    connection.release();
  }
  
  return { foreignKeys: discovered, warnings };
}

