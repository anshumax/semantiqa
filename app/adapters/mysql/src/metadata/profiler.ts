import type { Pool } from 'mysql2/promise';

export interface ColumnProfile {
  column: string;
  nullFraction: number | null;
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

const COLUMN_QUERY = `
SELECT
  table_schema,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
ORDER BY table_schema, table_name, ordinal_position;
`;

export interface MysqlProfileOptions {
  sampleSize?: number;
}

const DEFAULT_SAMPLE_SIZE = 1_000;

function escapeIdentifier(value: string): string {
  return `\`${value.replace(/`/g, '``')}\``;
}

export async function profileTables(
  pool: Pool,
  options: MysqlProfileOptions = {},
): Promise<TableProfile[]> {
  const sampleSize = options.sampleSize ?? DEFAULT_SAMPLE_SIZE;
  const connection = await pool.getConnection();

  try {
    const [columnsRows] = await connection.query(COLUMN_QUERY);
    const tables = new Map<string, TableProfile>();

    for (const row of columnsRows as Array<Record<string, unknown>>) {
      const schema = String(row.table_schema);
      const name = String(row.table_name);
      const column = String(row.column_name);
      const key = `${schema}.${name}`;

      if (!tables.has(key)) {
        tables.set(key, {
          schema,
          name,
          columns: [],
          sampledRows: 0,
        });
      }

      const table = tables.get(key)!;
      const escapedSchema = escapeIdentifier(schema);
      const escapedName = escapeIdentifier(name);
      const escapedColumn = escapeIdentifier(column);

      const sampleQuery = `
        SELECT
          COUNT(*) AS total_rows,
          SUM(CASE WHEN ${escapedColumn} IS NULL THEN 1 ELSE 0 END) AS null_count,
          COUNT(DISTINCT ${escapedColumn}) AS distinct_count,
          MIN(${escapedColumn}) AS min_value,
          MAX(${escapedColumn}) AS max_value
        FROM (
          SELECT ${escapedColumn}
          FROM ${escapedSchema}.${escapedName}
          LIMIT ${sampleSize}
        ) AS sample
      `;

      const [statsRows] = await connection.query(sampleQuery);
      const stats = (statsRows as Array<Record<string, unknown>>)[0] ?? {};

      const sampledRows = Number(stats.total_rows ?? 0);
      table.sampledRows = Math.max(table.sampledRows, sampledRows);

      table.columns.push({
        column,
        nullFraction:
          sampledRows > 0 && stats.null_count != null
            ? Number(stats.null_count) / sampledRows
            : null,
        distinctFraction:
          sampledRows > 0 && stats.distinct_count != null
            ? Number(stats.distinct_count) / sampledRows
            : null,
        min: stats.min_value as string | number | null,
        max: stats.max_value as string | number | null,
      });
    }

    return Array.from(tables.values());
  } finally {
    connection.release();
  }
}


