import type { Database } from 'better-sqlite3';
import type { SourcesAddRequest } from '@semantiqa/contracts';

type StoredSourceConfig = {
  description?: string;
  connection: Record<string, unknown>;
};

function sanitizeConnectionConfig(request: SourcesAddRequest): StoredSourceConfig {
  const { description } = request;

  switch (request.kind) {
    case 'postgres':
      return {
        description,
        connection: {
          host: request.connection.host,
          port: request.connection.port,
          database: request.connection.database,
          user: request.connection.user,
          ssl: request.connection.ssl ?? false,
        },
      } satisfies StoredSourceConfig;
    case 'mysql':
      return {
        description,
        connection: {
          host: request.connection.host,
          port: request.connection.port,
          database: request.connection.database,
          user: request.connection.user,
          ssl: request.connection.ssl ?? false,
        },
      } satisfies StoredSourceConfig;
    case 'mongo':
      return {
        description,
        connection: {
          database: request.connection.database,
          replicaSet: request.connection.replicaSet ?? null,
          hasCredentials: /@/.test(request.connection.uri),
        },
      } satisfies StoredSourceConfig;
    case 'duckdb':
      return {
        description,
        connection: {
          filePath: request.connection.filePath,
        },
      } satisfies StoredSourceConfig;
    default: {
      const exhaustive: never = request;
      return exhaustive;
    }
  }
}

export class SourceRepository {
  constructor(private readonly db: Database) {}

  addSource(
    payload: SourcesAddRequest,
    sourceId: string,
    initialCrawlStatus: 'not_crawled' | 'crawling' | 'crawled' | 'error' = 'not_crawled',
    initialConnectionStatus: 'unknown' | 'checking' | 'connected' | 'error' = 'unknown',
  ): { sourceId: string } {
    const config = sanitizeConnectionConfig(payload);
    const owners = payload.owners ?? [];
    const tags = payload.tags ?? [];

    const insertSource = this.db.prepare<{
      id: string;
      name: string;
      kind: string;
      config: string;
      owners: string;
      tags: string;
      status: string;
      connection_status: string;
    }>(
      `INSERT INTO sources (id, name, kind, config, owners, tags, status, connection_status)
       VALUES (@id, @name, @kind, json(@config), json(@owners), json(@tags), @status, @connection_status)`,
    );

    const transaction = this.db.transaction(() => {
      insertSource.run({
        id: sourceId,
        name: payload.name,
        kind: payload.kind,
        config: JSON.stringify(config),
        owners: JSON.stringify(owners),
        tags: JSON.stringify(tags),
        status: initialCrawlStatus,
        connection_status: initialConnectionStatus,
      });
    });

    transaction();

    return { sourceId };
  }

  updateCrawlStatus(
    sourceId: string,
    status: 'not_crawled' | 'crawling' | 'crawled' | 'error',
    error?: { message: string; meta?: Record<string, unknown> },
  ) {
    const update = this.db.prepare<{
      status: string;
      status_updated_at: string;
      last_crawl_at?: string | null;
      last_error?: string | null;
      last_error_meta?: string | null;
      id: string;
    }>(
      `UPDATE sources
         SET status = @status,
             status_updated_at = @status_updated_at,
             last_crawl_at = CASE WHEN @status = 'crawled' THEN DATETIME('now') ELSE last_crawl_at END,
             last_error = @last_error,
             last_error_meta = @last_error_meta
       WHERE id = @id`,
    );

    update.run({
      id: sourceId,
      status,
      status_updated_at: new Date().toISOString(),
      last_error: error ? error.message : null,
      last_error_meta: error?.meta ? JSON.stringify(error.meta) : null,
    });
  }

  updateConnectionStatus(
    sourceId: string,
    status: 'unknown' | 'checking' | 'connected' | 'error',
    errorMessage?: string,
  ) {
    const update = this.db.prepare<{
      connection_status: string;
      last_connected_at?: string | null;
      last_connection_error?: string | null;
      id: string;
    }>(
      `UPDATE sources
         SET connection_status = @connection_status,
             last_connected_at = CASE WHEN @connection_status = 'connected' THEN DATETIME('now') ELSE last_connected_at END,
             last_connection_error = @last_connection_error
       WHERE id = @id`,
    );

    update.run({
      id: sourceId,
      connection_status: status,
      last_connection_error: status === 'error' ? errorMessage ?? null : null,
    });
  }

  removeSource(sourceId: string): void {
    const transaction = this.db.transaction(() => {
      this.db.prepare('DELETE FROM sources WHERE id = ?').run(sourceId);
    });

    transaction();
  }
}

