"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crawlSchema = crawlSchema;
const zod_1 = require("zod");
const TableRowSchema = zod_1.z.object({
    table_schema: zod_1.z.string(),
    table_name: zod_1.z.string(),
    table_type: zod_1.z.string(),
    table_comment: zod_1.z.string().nullish(),
});
const ColumnRowSchema = zod_1.z.object({
    table_schema: zod_1.z.string(),
    table_name: zod_1.z.string(),
    column_name: zod_1.z.string(),
    data_type: zod_1.z.string(),
    is_nullable: zod_1.z.string(),
    column_default: zod_1.z.string().nullish(),
    character_maximum_length: zod_1.z.number().nullable(),
    numeric_precision: zod_1.z.number().nullable(),
    numeric_scale: zod_1.z.number().nullable(),
    column_comment: zod_1.z.string().nullish(),
});
const TABLE_QUERY = `
SELECT
  nspname AS table_schema,
  relname AS table_name,
  CASE WHEN relkind = 'r' THEN 'BASE TABLE' ELSE 'VIEW' END AS table_type,
  obj_description(pg_class.oid) AS table_comment
FROM pg_class
JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
WHERE relkind IN ('r', 'v')
  AND nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name;
`;
const COLUMN_QUERY = `
SELECT
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length,
  numeric_precision,
  numeric_scale,
  col_description(format('%s.%s', table_schema, table_name)::regclass::oid, ordinal_position) AS column_comment
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name, ordinal_position;
`;
async function crawlSchema(pool) {
    const client = await pool.connect();
    try {
        const tablesResult = await client.query(TABLE_QUERY);
        const columnsResult = await client.query(COLUMN_QUERY);
        const tables = tablesResult.rows.map((row) => TableRowSchema.parse(row));
        const columns = columnsResult.rows.map((row) => ColumnRowSchema.parse(row));
        const tableMap = new Map();
        for (const table of tables) {
            const key = `${table.table_schema}.${table.table_name}`;
            tableMap.set(key, {
                schema: table.table_schema,
                name: table.table_name,
                type: table.table_type === 'VIEW' ? 'VIEW' : 'BASE TABLE',
                comment: table.table_comment ?? null,
                columns: [],
            });
        }
        for (const column of columns) {
            const key = `${column.table_schema}.${column.table_name}`;
            const table = tableMap.get(key);
            if (!table) {
                continue;
            }
            table.columns.push({
                name: column.column_name,
                type: column.data_type,
                nullable: column.is_nullable === 'YES',
                defaultValue: column.column_default,
                comment: column.column_comment ?? null,
            });
        }
        return {
            tables: Array.from(tableMap.values()),
        };
    }
    finally {
        client.release();
    }
}
//# sourceMappingURL=crawler.js.map