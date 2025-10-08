import type { DuckDbAdapter } from '../duckdbAdapter';

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


