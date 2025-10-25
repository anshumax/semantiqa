import { MysqlAdapter } from '../mysqlAdapter';
import type { SchemaTable } from './crawler';
import { CrawlWarning } from './types';

export async function getRowCounts(
  adapter: MysqlAdapter,
  tables: SchemaTable[]
): Promise<{ rowCounts: Map<string, number | null>; warnings: CrawlWarning[] }> {
  const rowCounts = new Map<string, number | null>();
  const warnings: CrawlWarning[] = [];
  
  try {
    const connection = await adapter.getPool().getConnection();
    const [rows] = await connection.query(`
      SELECT table_schema, table_name, table_rows
      FROM information_schema.TABLES
      WHERE table_schema = DATABASE()
    `);
    
    for (const row of rows as any[]) {
      const key = `${row.table_schema}.${row.table_name}`;
      rowCounts.set(key, row.table_rows || null);
    }
    connection.release();
  } catch (error) {
    warnings.push({
      level: 'warning',
      feature: 'information_schema.TABLES',
      message: 'Cannot access table row counts from information_schema.',
      suggestion: 'Grant SELECT on information_schema.TABLES.'
    });
    
    for (const table of tables) {
      rowCounts.set(`${table.schema}.${table.name}`, null);
    }
  }
  
  return { rowCounts, warnings };
}

