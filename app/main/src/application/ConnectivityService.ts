import type Database from 'better-sqlite3';

import {
  MysqlAdapter,
  PostgresAdapter,
  DuckDbAdapter,
  MongoAdapter,
} from '@semantiqa/adapters';
import { SourceService } from '@semantiqa/graph-service';

export interface ConnectivityServiceDeps {
  openSourcesDb: () => Database;
  retrieveSecret: (scope: { sourceId: string; key: string }) => Promise<string | null>;
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
  kind: 'postgres' | 'mysql' | 'mongo' | 'duckdb';
  config: string;
}

export class ConnectivityService {
  constructor(private readonly deps: ConnectivityServiceDeps) {}

  async checkAllSources(): Promise<void> {
    const { openSourcesDb, logger } = this.deps;
    const db = openSourcesDb();
    const rows = db.prepare<SourceRecord>('SELECT id, kind, config FROM sources').all();

    for (const row of rows) {
      try {
        await this.checkSource(row.id);
      } catch (error) {
        logger.warn('Connectivity check failed', { sourceId: row.id, error });
      }
    }
  }

  async checkSource(sourceId: string): Promise<'connected' | 'error'> {
    const {
      openSourcesDb,
      retrieveSecret,
      audit,
      logger,
    } = this.deps;

    const db = openSourcesDb();
    const row = db
      .prepare<SourceRecord, [string]>('SELECT id, kind, config FROM sources WHERE id = ?')
      .get(sourceId);

    if (!row) {
      logger.warn('Source not found during connectivity check', { sourceId });
      return 'error';
    }

    const config = JSON.parse(row.config ?? '{}');

    const connection = await this.enrichConnection(
      row.kind,
      config.connection ?? {},
      sourceId,
      retrieveSecret,
    );

    const sourceService = new SourceService({ openDatabase: openSourcesDb });

    try {
      await this.testConnection(row.kind, connection);
      sourceService.setConnectionStatus(sourceId, 'connected');
      audit({
        action: 'connectivity.check.success',
        sourceId,
        status: 'success',
      });
      return 'connected';
    } catch (error) {
      const message = (error as Error).message ?? 'Unknown connection error';
      sourceService.setConnectionStatus(sourceId, 'error', message);
      audit({
        action: 'connectivity.check.failed',
        sourceId,
        status: 'failure',
        details: { error: message },
      });
      return 'error';
    }
  }

  private async enrichConnection(
    kind: SourceRecord['kind'],
    connection: Record<string, unknown>,
    sourceId: string,
    retrieveSecret: ConnectivityServiceDeps['retrieveSecret'],
  ) {
    const enriched = { ...connection };

    if (kind === 'postgres' || kind === 'mysql') {
      const password = await retrieveSecret({ sourceId, key: 'password' });
      if (password) {
        enriched.password = password;
      }
    }

    if (kind === 'mongo') {
      const uri = await retrieveSecret({ sourceId, key: 'uri' });
      if (uri) {
        enriched.uri = uri;
      }
    }

    return enriched;
  }

  private async testConnection(kind: SourceRecord['kind'], connection: Record<string, unknown>) {
    switch (kind) {
      case 'postgres': {
        const adapter = new PostgresAdapter({ connection });
        await adapter.healthCheck();
        await adapter.close();
        break;
      }
      case 'mysql': {
        const adapter = new MysqlAdapter({ connection });
        await adapter.healthCheck();
        await adapter.close();
        break;
      }
      case 'mongo': {
        const adapter = new MongoAdapter({ connection });
        await adapter.healthCheck();
        await adapter.close();
        break;
      }
      case 'duckdb': {
        const adapter = new DuckDbAdapter({ connection });
        await adapter.healthCheck();
        await adapter.close();
        break;
      }
      default: {
        const exhaustive: never = kind;
        return exhaustive;
      }
    }
  }
}
