import type { DuckDbAdapter } from '../duckdbAdapter';
import { CrawlWarning, AvailableFeatures, EnhancedCrawlResult } from './types';
import { getForeignKeys, type ForeignKeyConstraint } from './foreignKeys';

export interface DuckDbSchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
}

export interface DuckDbSchemaTable {
  name: string;
  type: 'TABLE' | 'VIEW';
  columns: DuckDbSchemaColumn[];
}

export interface DuckDbSchemaSnapshot {
  tables: DuckDbSchemaTable[];
  foreignKeys?: ForeignKeyConstraint[];
}

export async function crawlDuckDbSchema(adapter: DuckDbAdapter): Promise<DuckDbSchemaSnapshot> {
  const tables = await adapter.query<{ table_name: string; table_type: string }>(
    `SELECT table_name, table_type
     FROM information_schema.tables
     WHERE table_schema = 'main'
     ORDER BY table_name`,
  );

  const snapshotTables: DuckDbSchemaTable[] = [];

  for (const table of tables) {
    const columns = await adapter.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'main'
         AND table_name = ?
       ORDER BY ordinal_position`,
      [table.table_name],
    );

    snapshotTables.push({
      name: table.table_name,
      type: table.table_type === 'VIEW' ? 'VIEW' : 'TABLE',
      columns: columns.map((column) => ({
        name: column.column_name,
        type: column.data_type,
        nullable: column.is_nullable === 'YES',
      })),
    });
  }

  return { tables: snapshotTables };
}

export async function crawlDuckDbSchemaWithForeignKeys(adapter: DuckDbAdapter): Promise<EnhancedCrawlResult<DuckDbSchemaSnapshot>> {
  const warnings: CrawlWarning[] = [];
  const features: AvailableFeatures = {
    hasRowCounts: false,
    hasStatistics: false,
    hasComments: false,
    hasPermissionErrors: false,
  };
  
  // Crawl schema
  let tables: DuckDbSchemaTable[];
  try {
    const schemaResult = await crawlDuckDbSchema(adapter);
    tables = schemaResult.tables;
  } catch (error) {
    warnings.push({
      level: 'error',
      feature: 'schema_crawl',
      message: `Failed to crawl schema: ${(error as Error).message}`,
      suggestion: 'Verify database file permissions and accessibility.'
    });
    features.hasPermissionErrors = true;
    tables = [];
  }
  
  // Discover foreign keys
  const { foreignKeys, warnings: fkWarnings } = await getForeignKeys(adapter);
  warnings.push(...fkWarnings);
  
  return {
    data: {
      tables,
      foreignKeys: foreignKeys.length > 0 ? foreignKeys : undefined,
    },
    warnings,
    availableFeatures: features,
  };
}


