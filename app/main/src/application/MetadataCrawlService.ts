import type { SemantiqaError } from '@semantiqa/contracts';
import type Database from 'better-sqlite3';

import { PostgresAdapter, crawlSchema as crawlPostgres, profileTables as profilePostgres } from '@semantiqa/adapters-postgres';
import { MysqlAdapter, crawlSchema as crawlMysql, profileTables as profileMysql } from '@semantiqa/adapters-mysql';
import { MongoAdapter, crawlMongoSchema, profileCollections as profileMongo } from '@semantiqa/adapters-mongo';
import { DuckDbAdapter, crawlDuckDbSchema, profileTables as profileDuckDb } from '@semantiqa/adapters-duckdb';

export interface MetadataCrawlDeps {
  openSourcesDb: () => Database;
  retrieveSecret: (scope: { sourceId: string; key: string }) => Promise<string | null>;
  persistSnapshot: (params: {
    sourceId: string;
    kind: string;
    snapshot: unknown;
    stats: unknown;
  }) => Promise<void>;
  updateSourceStatus: (
    sourceId: string,
    status: 'connecting' | 'queued' | 'ready' | 'error' | 'needs_attention',
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

interface SourceRecord {
  id: string;
  name: string;
  kind: 'postgres' | 'mysql' | 'mongo' | 'duckdb';
  config: string;
}

export class MetadataCrawlService {
  constructor(private readonly deps: MetadataCrawlDeps) {}

  async crawlSource(sourceId: string): Promise<{ snapshotId: string } | SemantiqaError> {
    const { openSourcesDb, retrieveSecret, persistSnapshot, updateSourceStatus, audit, logger } = this.deps;

    logger.info('Starting metadata crawl', { sourceId });
    audit({ action: 'metadata.crawl.started', sourceId, status: 'success' });

    try {
      await updateSourceStatus(sourceId, 'queued');

      // Load source config
      const db = openSourcesDb();
      const source = db.prepare<SourceRecord, [string]>('SELECT id, name, kind, config FROM sources WHERE id = ?').get(sourceId);

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
      const config = JSON.parse(source.config);

      // Retrieve secrets and merge into connection config
      const connection = await this.loadConnectionWithSecrets(source.kind, config.connection, sourceId, retrieveSecret);

      // Dispatch to adapter-specific crawl + profile + persist
      let snapshot: unknown;
      let stats: unknown;

      switch (source.kind) {
        case 'postgres': {
          const adapter = new PostgresAdapter({ connection });
          await adapter.healthCheck();
          snapshot = await crawlPostgres(adapter);
          stats = await profilePostgres(adapter, snapshot, { sampleSize: 1000 });
          await adapter.close();
          break;
        }
        case 'mysql': {
          const adapter = new MysqlAdapter({ connection });
          await adapter.healthCheck();
          snapshot = await crawlMysql(adapter);
          stats = await profileMysql(adapter, snapshot, { sampleSize: 1000 });
          await adapter.close();
          break;
        }
        case 'mongo': {
          const adapter = new MongoAdapter({ connection });
          await adapter.healthCheck();
          snapshot = await crawlMongoSchema(adapter, { sampleSize: 1000 });
          stats = await profileMongo(adapter, snapshot, { sampleSize: 1000 });
          await adapter.close();
          break;
        }
        case 'duckdb': {
          const adapter = new DuckDbAdapter({ connection });
          await adapter.healthCheck();
          snapshot = await crawlDuckDbSchema(adapter);
          stats = await profileDuckDb(adapter, snapshot, { sampleSize: 1000 });
          await adapter.close();
          break;
        }
        default: {
          const exhaustive: never = source.kind;
          return exhaustive;
        }
      }

      // Persist snapshot
      await persistSnapshot({ sourceId, kind: source.kind, snapshot, stats });

      await updateSourceStatus(sourceId, 'ready');
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
      await updateSourceStatus(sourceId, 'error');
      audit({
        action: 'metadata.crawl.failed',
        sourceId,
        status: 'failure',
        details: { error: (error as Error).message ?? 'Unknown error' },
      });

      return {
        code: 'INTERNAL_ERROR',
        message: 'Failed to crawl metadata',
        details: { error: (error as Error).message ?? 'Unknown error' },
      } satisfies SemantiqaError;
    }
  }

  private async loadConnectionWithSecrets(
    kind: string,
    storedConnection: Record<string, unknown>,
    sourceId: string,
    retrieveSecret: MetadataCrawlDeps['retrieveSecret'],
  ): Promise<Record<string, unknown>> {
    const connection = { ...storedConnection };

    // Retrieve password for postgres/mysql
    if (kind === 'postgres' || kind === 'mysql') {
      const password = await retrieveSecret({ sourceId, key: 'password' });
      if (password) {
        connection.password = password;
      }
    }

    // Retrieve URI for mongo
    if (kind === 'mongo') {
      const uri = await retrieveSecret({ sourceId, key: 'uri' });
      if (uri) {
        connection.uri = uri;
      }
    }

    return connection;
  }
}

