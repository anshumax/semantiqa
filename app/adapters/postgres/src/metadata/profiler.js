"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileTables = profileTables;
const PROFILE_QUERY = `
SELECT
  table_schema,
  table_name,
  column_name,
  data_type,
  pg_stats.null_frac,
  pg_stats.avg_width,
  pg_stats.n_distinct
FROM pg_stats
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name, column_name;
`;
async function profileTables(pool) {
    const client = await pool.connect();
    try {
        const result = await client.query(PROFILE_QUERY);
        const tables = new Map();
        for (const row of result.rows) {
            const key = `${row.table_schema}.${row.table_name}`;
            if (!tables.has(key)) {
                tables.set(key, {
                    schema: row.table_schema,
                    name: row.table_name,
                    columns: [],
                    sampledRows: 0,
                });
            }
            const table = tables.get(key);
            table.columns.push({
                column: row.column_name,
                nullFraction: Number(row.null_frac ?? 0),
                distinctFraction: typeof row.n_distinct === 'number' ? row.n_distinct : null,
            });
        }
        return Array.from(tables.values());
    }
    finally {
        client.release();
    }
}
//# sourceMappingURL=profiler.js.map