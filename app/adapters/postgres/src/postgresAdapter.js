"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresAdapter = exports.PostgresConnectionSchema = void 0;
const pg_1 = require("pg");
const zod_1 = require("zod");
exports.PostgresConnectionSchema = zod_1.z.object({
    host: zod_1.z.string().nonempty(),
    port: zod_1.z.number().int().min(1).max(65535),
    database: zod_1.z.string().nonempty(),
    user: zod_1.z.string().nonempty(),
    password: zod_1.z.string().nonempty(),
    ssl: zod_1.z
        .union([
        zod_1.z.literal(true),
        zod_1.z.literal(false),
        zod_1.z.object({ rejectUnauthorized: zod_1.z.boolean().optional() }),
    ])
        .optional(),
});
const READ_ONLY_REGEX = /^(\s*WITH\s+[\s\S]+?\)\s*)?\s*(SELECT|EXPLAIN|SHOW|DESCRIBE)/i;
class PostgresAdapter {
    pool;
    constructor(options) {
        const config = exports.PostgresConnectionSchema.parse(options.connection);
        const poolConfig = {
            host: config.host,
            port: config.port,
            database: config.database,
            user: config.user,
            password: config.password,
            ssl: config.ssl,
            connectionTimeoutMillis: options.connectionTimeoutMs ?? 5_000,
        };
        const factory = options.poolFactory ?? ((cfg) => new pg_1.Pool(cfg));
        this.pool = factory(poolConfig);
    }
    async healthCheck() {
        const client = await this.pool.connect();
        try {
            const result = await client.query('SELECT 1');
            return result.rowCount === 1;
        }
        finally {
            client.release();
        }
    }
    ensureReadOnly(sql) {
        const normalized = sql.trim();
        if (!READ_ONLY_REGEX.test(normalized)) {
            throw new Error('Query must be read-only (SELECT/EXPLAIN/SHOW)');
        }
    }
    async query(text, params = []) {
        this.ensureReadOnly(text);
        const client = await this.pool.connect();
        try {
            const result = await client.query(text, params);
            return result.rows;
        }
        finally {
            client.release();
        }
    }
    async close() {
        await this.pool.end();
    }
}
exports.PostgresAdapter = PostgresAdapter;
//# sourceMappingURL=postgresAdapter.js.map