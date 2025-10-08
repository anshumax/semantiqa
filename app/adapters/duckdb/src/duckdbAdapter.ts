import type { TableData } from 'duckdb';
import duckdb, { Database as DuckDatabase, OPEN_READONLY } from 'duckdb';

import { z } from 'zod';

export const DuckDbConnectionSchema = z.object({
  filePath: z.string().nonempty(),
  readOnly: z.boolean().default(true),
});

export type DuckDbConnectionConfig = z.infer<typeof DuckDbConnectionSchema>;

export interface DuckDbAdapterOptions {
  connection: DuckDbConnectionConfig;
  databaseFactory?: (filePath: string, accessMode?: number) => DuckDatabase;
}

export class DuckDbAdapter {
  private db?: DuckDatabase;
  private readonly config: DuckDbConnectionConfig;
  private readonly databaseFactory: (filePath: string, accessMode?: number) => DuckDatabase;

  constructor(options: DuckDbAdapterOptions) {
    this.config = DuckDbConnectionSchema.parse(options.connection);
    this.databaseFactory =
      options.databaseFactory ?? ((filePath, accessMode) => new DuckDatabase(filePath, accessMode));
  }

  private getDatabase(): DuckDatabase {
    if (!this.db) {
      const { filePath, readOnly } = this.config;
      const accessMode = readOnly ? OPEN_READONLY : undefined;
      this.db = this.databaseFactory(filePath, accessMode);
    }
    return this.db;
  }

  async healthCheck(): Promise<boolean> {
    const db = this.getDatabase();
    const connection = db.connect();
    try {
      const result = await new Promise<TableData>((resolve, reject) => {
        connection.all('SELECT 1 AS ok', (error: unknown, rows: TableData) => {
          if (error) {
            reject(error);
          } else {
            resolve(rows);
          }
        });
      });
      return Array.isArray(result) && result.length === 1 && (result[0] as { ok?: number })?.ok === 1;
    } finally {
      await connection.close();
    }
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    const db = this.getDatabase();
    const connection = db.connect();
    try {
      return await new Promise<T[]>((resolve, reject) => {
        connection.all(sql, ...(params as []), (error: unknown, rows: TableData) => {
          if (error) {
            reject(error);
          } else {
            resolve(rows as unknown as T[]);
          }
        });
      });
    } finally {
      await connection.close();
    }
  }

  async close() {
    if (this.db) {
      await this.db.close();
      this.db = undefined;
    }
  }
}


