"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MysqlAdapter = exports.MysqlConnectionSchema = void 0;
const promise_1 = require("mysql2/promise");
const zod_1 = require("zod");
exports.MysqlConnectionSchema = zod_1.z.object({
    host: zod_1.z.string().nonempty(),
    port: zod_1.z.number().int().min(1).max(65535),
    database: zod_1.z.string().nonempty(),
    user: zod_1.z.string().nonempty(),
    password: zod_1.z.string().nonempty(),
    ssl: zod_1.z
        .union([
        zod_1.z.literal(true),
        zod_1.z.literal(false),
        zod_1.z.object({
            rejectUnauthorized: zod_1.z.boolean().optional(),
            minVersion: zod_1.z.string().optional(),
        }),
    ])
        .optional(),
});
const READ_ONLY_REGEX = /^(\s*WITH\s+[\s\S]+?\)\s*)?\s*(SELECT|EXPLAIN|SHOW|DESCRIBE)/i;
class MysqlAdapter {
    pool;
    constructor(options) {
        const config = exports.MysqlConnectionSchema.parse(options.connection);
        let sslOption;
        if (config.ssl === true) {
            sslOption = {};
        }
        else if (config.ssl === false || config.ssl === undefined) {
            sslOption = undefined;
        }
        else {
            sslOption = config.ssl;
        }
        const poolConfig = {
            host: config.host,
            port: config.port,
            database: config.database,
            user: config.user,
            password: config.password,
            ssl: sslOption,
            connectTimeout: options.connectionTimeoutMs ?? 5_000,
            namedPlaceholders: true,
        };
        const factory = options.poolFactory ?? ((cfg) => (0, promise_1.createPool)(cfg));
        this.pool = factory(poolConfig);
    }
    async healthCheck() {
        const connection = await this.pool.getConnection();
        try {
            const [rows] = await connection.query('SELECT 1');
            return Array.isArray(rows) && rows.length > 0;
        }
        finally {
            connection.release();
        }
    }
    ensureReadOnly(sql) {
        const normalized = sql.trim();
        if (!READ_ONLY_REGEX.test(normalized)) {
            throw new Error('Query must be read-only (SELECT/EXPLAIN/SHOW/DESCRIBE)');
        }
    }
    async query(sql, params = []) {
        this.ensureReadOnly(sql);
        const connection = await this.pool.getConnection();
        try {
            const [rows] = await connection.query(sql, params);
            return rows;
        }
        finally {
            connection.release();
        }
    }
    async close() {
        await this.pool.end();
    }
}
exports.MysqlAdapter = MysqlAdapter;
//# sourceMappingURL=mysqlAdapter.js.map