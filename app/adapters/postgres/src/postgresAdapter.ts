import { Pool, type PoolConfig, type QueryResultRow } from 'pg';
import { z } from 'zod';

export const PostgresConnectionSchema = z.object({
  host: z.string().nonempty(),
  port: z.number().int().min(1).max(65535),
  database: z.string().nonempty(),
  user: z.string().nonempty(),
  password: z.string().nonempty(),
  ssl: z
    .union([
      z.literal(true),
      z.literal(false),
      z.object({ rejectUnauthorized: z.boolean().optional() }),
    ])
    .optional(),
});

export type PostgresConnectionConfig = z.infer<typeof PostgresConnectionSchema>;

export interface PostgresAdapterOptions {
  connection: PostgresConnectionConfig;
  connectionTimeoutMs?: number;
  poolFactory?: (config: PoolConfig) => Pool;
}

const READ_ONLY_REGEX = /^(\s*WITH\s+[\s\S]+?\)\s*)?\s*(SELECT|EXPLAIN|SHOW|DESCRIBE)/i;

export class PostgresAdapter {
  private readonly pool: Pool;
  public getPool(): Pool {
    return this.pool;
  }

  constructor(options: PostgresAdapterOptions) {
    const config = PostgresConnectionSchema.parse(options.connection);
    const poolConfig = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl,
      connectionTimeoutMillis: options.connectionTimeoutMs ?? 5_000,
    } as const;

    const factory = options.poolFactory ?? ((cfg) => new Pool(cfg));
    this.pool = factory(poolConfig);
  }

  async healthCheck(): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT 1');
      return result.rowCount === 1;
    } finally {
      client.release();
    }
  }

  private ensureReadOnly(sql: string) {
    const normalized = sql.trim();
    if (!READ_ONLY_REGEX.test(normalized)) {
      throw new Error('Query must be read-only (SELECT/EXPLAIN/SHOW)');
    }
  }

  async query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
    this.ensureReadOnly(text);

    const client = await this.pool.connect();
    try {
      const result = await client.query<T>(text, params as unknown[]);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}

