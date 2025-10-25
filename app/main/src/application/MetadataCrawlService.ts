import type { SemantiqaError } from '@semantiqa/contracts';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';

import {
  PostgresAdapter,
  crawlSchema as crawlPostgres,
  profileTables as profilePostgres,
} from '@semantiqa/adapter-postgres';
import {
  MysqlAdapter,
  crawlSchema as crawlMysql,
  profileTables as profileMysql,
} from '@semantiqa/adapter-mysql';
import {
  MongoAdapter,
  crawlMongoSchema,
  profileMongoCollections,
} from '@semantiqa/adapter-mongo';
import {
  DuckDbAdapter,
  crawlDuckDbSchema,
  profileDuckDbTables,
} from '@semantiqa/adapter-duckdb';
import { SourceService } from '@semantiqa/graph-service';
import type {
  MongoConnection,
  MySqlConnection,
  PostgresConnection,
  DuckDbConnection,
} from '@semantiqa/contracts';

export interface MetadataCrawlDeps {
  openSourcesDb: () => BetterSqliteDatabase;
  retrieveSecret: (scope: { sourceId: string; key: string }) => Promise<string | null>;
  persistSnapshot: (params: {
    sourceId: string;
    kind: string;
    snapshot: unknown;
    stats: unknown;
    warnings?: Array<{ level: string; feature: string; message: string; suggestion?: string }>;
  }) => Promise<void>;
  updateCrawlStatus: (
    sourceId: string,
    status: 'not_crawled' | 'crawling' | 'crawled' | 'error',
    error?: { message: string; meta?: Record<string, unknown> },
  ) => Promise<void> | void;
  updateConnectionStatus: (
    sourceId: string,
    status: 'unknown' | 'checking' | 'connected' | 'error',
    error?: { message: string; meta?: Record<string, unknown> },
  ) => Promise<void> | void;
  audit: (event: {
    action: string;
    sourceId: string;
    status: 'success' | 'failure';
    details?: Record<string, unknown>;
  }) => void;
  logger: {
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
  };
}

interface MetadataSourceRow {
  id: string;
  name: string;
  kind: 'postgres' | 'mysql' | 'mongo' | 'duckdb';
  config: string;
}

export class MetadataCrawlService {
  constructor(private readonly deps: MetadataCrawlDeps) {}

  async crawlSource(sourceId: string): Promise<{ snapshotId: string } | SemantiqaError> {
    const { openSourcesDb, retrieveSecret, persistSnapshot, updateCrawlStatus, updateConnectionStatus, audit, logger } = this.deps;

    const sourceService = new SourceService({ openDatabase: openSourcesDb });

    logger.info('Starting metadata crawl', { sourceId });
    audit({ action: 'metadata.crawl.started', sourceId, status: 'success' });

    try {
      await updateCrawlStatus(sourceId, 'crawling');
      sourceService.setCrawlStatus(sourceId, 'crawling');

      // Load source config
      const db = openSourcesDb();
      const source = db
        .prepare('SELECT id, name, kind, config FROM sources WHERE id = ?')
        .get(sourceId) as MetadataSourceRow | undefined;

      if (!source) {
        logger.warn('Source not found', { sourceId });
        audit({ action: 'metadata.crawl.source_not_found', sourceId, status: 'failure' });
        return {
          code: 'NOT_FOUND',
          message: `Source ${sourceId} not found`,
        } satisfies SemantiqaError;
      }

      logger.info('Source loaded', { sourceId, kind: source.kind });

      // Parse config
      const config = JSON.parse(source.config ?? '{}') as { connection?: Record<string, unknown> }; 

      // Retrieve secrets and merge into connection config
      const connection = await this.loadConnectionWithSecrets(
        source.kind,
        config.connection ?? {},
        sourceId,
        retrieveSecret,
      );

      // Dispatch to adapter-specific crawl + profile + persist
      let snapshot: unknown;
      let stats: unknown;

      switch (source.kind) {
        case 'postgres': {
          const adapter = new PostgresAdapter({ connection: connection as PostgresConnection });
          await adapter.healthCheck();
          // Update connection status to connected after successful health check
          await updateConnectionStatus(sourceId, 'connected');
          sourceService.setConnectionStatus(sourceId, 'connected');
          snapshot = await crawlPostgres(adapter);
          stats = await profilePostgres(adapter);
          await adapter.close();
          break;
        }
        case 'mysql': {
          const adapter = new MysqlAdapter({ connection: connection as MySqlConnection });
          await adapter.healthCheck();
          // Update connection status to connected after successful health check
          await updateConnectionStatus(sourceId, 'connected');
          sourceService.setConnectionStatus(sourceId, 'connected');
          snapshot = await crawlMysql(adapter);
          stats = await profileMysql(adapter, { sampleSize: 1000 });
          await adapter.close();
          break;
        }
        case 'mongo': {
          const adapter = new MongoAdapter({ connection: connection as MongoConnection });
          await adapter.healthCheck();
          // Update connection status to connected after successful health check
          await updateConnectionStatus(sourceId, 'connected');
          sourceService.setConnectionStatus(sourceId, 'connected');
          snapshot = await crawlMongoSchema(adapter, { sampleSize: 1000 });
          stats = await profileMongoCollections(adapter, { sampleSize: 1000 });
          await adapter.close();
          break;
        }
        case 'duckdb': {
          const adapter = new DuckDbAdapter({ connection: { ...connection as DuckDbConnection, readOnly: false } });
          await adapter.healthCheck();
          // Update connection status to connected after successful health check
          await updateConnectionStatus(sourceId, 'connected');
          sourceService.setConnectionStatus(sourceId, 'connected');
          snapshot = await crawlDuckDbSchema(adapter);
          stats = await profileDuckDbTables(adapter, { sampleSize: 1000 });
          await adapter.close();
          break;
        }
        default: {
          const exhaustive: never = source.kind;
          return exhaustive;
        }
      }

      // Extract warnings from snapshot and stats
      const allWarnings = [
        ...((snapshot as any).warnings || []),
        ...((stats as any).warnings || []),
      ];

      if (allWarnings.length > 0) {
        logger.warn('Crawl completed with warnings', { 
          sourceId, 
          warningCount: allWarnings.length,
          warnings: allWarnings.map((w: any) => ({
            level: w.level,
            feature: w.feature,
            message: w.message,
          }))
        });
        
        // If there are error-level warnings, broadcast them
        const criticalWarnings = allWarnings.filter((w: any) => w.level === 'error');
        if (criticalWarnings.length > 0) {
          logger.error('Critical crawl warnings', { sourceId, warnings: criticalWarnings });
        }
      }

      // Persist snapshot - handle both wrapped and unwrapped formats
      await persistSnapshot({ 
        sourceId, 
        kind: source.kind, 
        snapshot: (snapshot as any).data || snapshot,
        stats: (stats as any).data || stats,
        warnings: allWarnings,
      });

      await updateCrawlStatus(sourceId, 'crawled');
      sourceService.setCrawlStatus(sourceId, 'crawled');
      audit({
        action: 'metadata.crawl.completed',
        sourceId,
        status: 'success',
        details: { kind: source.kind },
      });

      logger.info('Metadata crawl completed', { sourceId });
      return { snapshotId: sourceId };
    } catch (error) {
      logger.error('Metadata crawl failed', { sourceId, error });
      const errorMeta = { message: (error as Error).message ?? 'Unknown error' };
      await updateCrawlStatus(sourceId, 'error', errorMeta);
      sourceService.setCrawlStatus(sourceId, 'error', errorMeta);
      audit({
        action: 'metadata.crawl.failed',
        sourceId,
        status: 'failure',
        details: errorMeta,
      });

      // Connection might be bad as well
      await updateConnectionStatus(sourceId, 'error', errorMeta);
      sourceService.setConnectionStatus(sourceId, 'error', errorMeta.message);

      return {
        code: 'INTERNAL_ERROR',
        message: 'Failed to crawl metadata',
        details: { error: (error as Error).message ?? 'Unknown error' },
      } satisfies SemantiqaError;
    }
  }

  private async loadConnectionWithSecrets(
    kind: MetadataSourceRow['kind'],
    storedConnection: Record<string, unknown>,
    sourceId: string,
    retrieveSecret: MetadataCrawlDeps['retrieveSecret'],
  ): Promise<PostgresConnection | MySqlConnection | MongoConnection | DuckDbConnection> {
    const connection = { ...storedConnection } as Record<string, unknown>;

    if (kind === 'postgres' || kind === 'mysql') {
      const password = await retrieveSecret({ sourceId, key: 'password' });
      if (password) {
        connection.password = password;
      }
    }

    if (kind === 'mongo') {
      const uri = await retrieveSecret({ sourceId, key: 'uri' });
      if (uri) {
        connection.uri = uri;
      }
    }

    if (kind === 'duckdb') {
      connection.readOnly = (connection.readOnly as boolean | undefined) ?? true;
    }

    return connection as PostgresConnection | MySqlConnection | MongoConnection | DuckDbConnection;
  }
}

