import type { Database } from 'better-sqlite3';

export class SourceSummaryRepository {
  constructor(private readonly db: Database) {}

  list() {
    type SourceRow = {
      id: string;
      name: string;
      kind: 'postgres' | 'mysql' | 'mongo' | 'duckdb';
      status: 'not_crawled' | 'crawling' | 'crawled' | 'error';
      status_updated_at?: string;
      last_crawl_at?: string;
      last_error?: string;
      last_error_meta?: string;
      connection_status: 'unknown' | 'checking' | 'connected' | 'error';
      last_connected_at?: string;
      last_connection_error?: string;
    };

    const statement = this.db.prepare(
      `SELECT id,
              name,
              kind,
              status,
              status_updated_at,
              last_crawl_at,
              last_error,
              last_error_meta,
              connection_status,
              last_connected_at,
              last_connection_error
         FROM sources`,
    );

    const rows = statement.all() as SourceRow[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind,
      status: row.status ?? 'not_crawled',
      statusUpdatedAt: row.status_updated_at ?? undefined,
      lastCrawlAt: row.last_crawl_at ?? undefined,
      lastError: row.last_error ?? undefined,
      lastErrorMeta: row.last_error_meta ? JSON.parse(row.last_error_meta) : undefined,
      connectionStatus: row.connection_status ?? 'unknown',
      lastConnectedAt: row.last_connected_at ?? undefined,
      lastConnectionError: row.last_connection_error ?? undefined,
    }));
  }

  updateStatus(
    sourceId: string,
    status: 'not_crawled' | 'crawling' | 'crawled' | 'error',
    error?: { message: string; meta?: Record<string, unknown> },
  ): void {
    this.db
      .prepare<{
        id: string;
        status: 'not_crawled' | 'crawling' | 'crawled' | 'error';
        status_updated_at: string;
        last_error?: string | null;
        last_error_meta?: string | null;
      }>(
        `UPDATE sources
            SET status = @status,
                status_updated_at = @status_updated_at,
                last_crawl_at = CASE WHEN @status = 'crawled' THEN DATETIME('now') ELSE last_crawl_at END,
                last_error = @last_error,
                last_error_meta = @last_error_meta
          WHERE id = @id`,
      )
      .run({
        id: sourceId,
        status,
        status_updated_at: new Date().toISOString(),
        last_error: error?.message ?? null,
        last_error_meta: error?.meta ? JSON.stringify(error.meta) : null,
      });
  }

  updateConnectionStatus(
    sourceId: string,
    status: 'unknown' | 'checking' | 'connected' | 'error',
    errorMessage?: string,
  ): void {
    this.db
      .prepare<{
        id: string;
        connection_status: 'unknown' | 'checking' | 'connected' | 'error';
        last_connected_at?: string | null;
        last_connection_error?: string | null;
      }>(
        `UPDATE sources
            SET connection_status = @connection_status,
                last_connected_at = CASE WHEN @connection_status = 'connected' THEN DATETIME('now') ELSE last_connected_at END,
                last_connection_error = @last_connection_error
          WHERE id = @id`,
      )
      .run({
        id: sourceId,
        connection_status: status,
        last_connection_error: status === 'error' ? errorMessage ?? null : null,
      });
  }
}


