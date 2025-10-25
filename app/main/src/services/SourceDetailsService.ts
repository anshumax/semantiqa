import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import type { SemantiqaError } from '@semantiqa/contracts';

export interface SourceDetailsServiceDeps {
  openSourcesDb: () => BetterSqliteDatabase;
}

export interface SourceDetailsResponse {
  sourceId: string;
  name: string;
  kind: 'postgres' | 'mysql' | 'mongo' | 'duckdb';
  databaseName?: string;
  connectionStatus: 'unknown' | 'checking' | 'connected' | 'error';
  crawlStatus: 'not_crawled' | 'crawling' | 'crawled' | 'error';
  lastConnectedAt?: string;
  lastCrawlAt?: string;
  lastError?: string;
  statistics: {
    tableCount: number;
    totalColumns: number;
    schemas?: Array<{ name: string; tableCount: number }>;
  };
}

export class SourceDetailsService {
  constructor(private readonly deps: SourceDetailsServiceDeps) {}

  async getSourceDetails(sourceId: string): Promise<SourceDetailsResponse | SemantiqaError> {
    try {
      const db = this.deps.openSourcesDb();
      
      // Get source metadata
      const sourceRow = db.prepare(`
        SELECT id, name, kind, config, status, connection_status, 
               last_connected_at, last_crawl_at, last_error
        FROM sources 
        WHERE id = ?
      `).get(sourceId) as {
        id: string;
        name: string;
        kind: 'postgres' | 'mysql' | 'mongo' | 'duckdb';
        config: string;
        status: 'not_crawled' | 'crawling' | 'crawled' | 'error';
        connection_status: 'unknown' | 'checking' | 'connected' | 'error';
        last_connected_at?: string;
        last_crawl_at?: string;
        last_error?: string;
      } | undefined;

      if (!sourceRow) {
        return {
          code: 'NOT_FOUND',
          message: 'Source not found',
          details: { sourceId },
        } satisfies SemantiqaError;
      }

      const config = JSON.parse(sourceRow.config);
      const databaseName = config.database || config.dbName;

      // Count tables for this source
      const tableCountResult = db.prepare(`
        SELECT COUNT(*) as count
        FROM nodes 
        WHERE type IN ('table', 'collection')
        AND json_extract(props, '$.sourceId') = ?
      `).get(sourceId) as { count: number } | undefined;

      const tableCount = tableCountResult?.count || 0;

      // Count total columns
      const columnCountResult = db.prepare(`
        SELECT COUNT(*) as count
        FROM nodes 
        WHERE type IN ('column', 'field')
        AND json_extract(props, '$.sourceId') = ?
      `).get(sourceId) as { count: number } | undefined;

      const totalColumns = columnCountResult?.count || 0;

      // Get schema breakdown (for relational databases)
      const schemaRows = db.prepare(`
        SELECT 
          json_extract(props, '$.schema') as schema_name,
          COUNT(*) as table_count
        FROM nodes 
        WHERE type = 'table'
        AND json_extract(props, '$.sourceId') = ?
        AND json_extract(props, '$.schema') IS NOT NULL
        GROUP BY json_extract(props, '$.schema')
        ORDER BY table_count DESC
      `).all(sourceId) as Array<{ schema_name: string; table_count: number }>;

      const schemas = schemaRows.map(row => ({
        name: row.schema_name,
        tableCount: row.table_count,
      }));

      return {
        sourceId: sourceRow.id,
        name: sourceRow.name,
        kind: sourceRow.kind,
        databaseName,
        connectionStatus: sourceRow.connection_status,
        crawlStatus: sourceRow.status,
        lastConnectedAt: sourceRow.last_connected_at,
        lastCrawlAt: sourceRow.last_crawl_at,
        lastError: sourceRow.last_error || undefined,
        statistics: {
          tableCount,
          totalColumns,
          schemas: schemas.length > 0 ? schemas : undefined,
        },
      };
    } catch (error) {
      console.error('Error fetching source details:', error);
      return {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve source details',
        details: { error: (error as Error).message ?? 'Unknown error' },
      } satisfies SemantiqaError;
    }
  }
}

