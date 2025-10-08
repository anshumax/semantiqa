import { createPool, type Pool, type PoolOptions } from 'mysql2/promise';

import type { RowDataPacket } from 'mysql2';
import { z } from 'zod';

export const MysqlConnectionSchema = z.object({
  host: z.string().nonempty(),
  port: z.number().int().min(1).max(65535),
  database: z.string().nonempty(),
  user: z.string().nonempty(),
  password: z.string().nonempty(),
  ssl: z
    .union([
      z.literal(true),
      z.literal(false),
      z.object({
        rejectUnauthorized: z.boolean().optional(),
        minVersion: z.string().optional(),
      }),
    ])
    .optional(),
});

export type MysqlConnectionConfig = z.infer<typeof MysqlConnectionSchema>;

export interface MysqlAdapterOptions {
  connection: MysqlConnectionConfig;
  connectionTimeoutMs?: number;
  poolFactory?: (config: PoolOptions) => Pool;
}

const READ_ONLY_REGEX = /^(\s*WITH\s+[\s\S]+?\)\s*)?\s*(SELECT|EXPLAIN|SHOW|DESCRIBE)/i;

export class MysqlAdapter {
  private readonly pool: Pool;

  constructor(options: MysqlAdapterOptions) {
    const config = MysqlConnectionSchema.parse(options.connection);
    let sslOption: PoolOptions['ssl'];

    if (config.ssl === true) {
      sslOption = {};
    } else if (config.ssl === false || config.ssl === undefined) {
      sslOption = undefined;
    } else {
      sslOption = config.ssl;
    }

    const poolConfig: PoolOptions = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: sslOption,
      connectTimeout: options.connectionTimeoutMs ?? 5_000,
      namedPlaceholders: true,
    };

    const factory = options.poolFactory ?? ((cfg: PoolOptions) => createPool(cfg));
    this.pool = factory(poolConfig);
  }

  async healthCheck(): Promise<boolean> {
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.query('SELECT 1');
      return Array.isArray(rows) && rows.length > 0;
    } finally {
      connection.release();
    }
  }

  private ensureReadOnly(sql: string) {
    const normalized = sql.trim();
    if (!READ_ONLY_REGEX.test(normalized)) {
      throw new Error('Query must be read-only (SELECT/EXPLAIN/SHOW/DESCRIBE)');
    }
  }

  async query<T = RowDataPacket[]>(sql: string, params: unknown[] = []): Promise<T> {
    this.ensureReadOnly(sql);

    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.query(sql, params as never[]);
      return rows as T;
    } finally {
      connection.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}


