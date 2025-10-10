import type { Database as BetterSqliteDatabase } from 'better-sqlite3';

import type {
  MongoConnection,
  MySqlConnection,
  PostgresConnection,
  DuckDbConnection,
} from '@semantiqa/contracts';

import {
  MysqlAdapter,
  PostgresAdapter,
  DuckDbAdapter,
  MongoAdapter,
} from '@semantiqa/adapters-runtime';
import { SourceService } from '@semantiqa/graph-service';

export interface ConnectivityServiceDeps {
  openSourcesDb: () => BetterSqliteDatabase;
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

export type ConnectivityCheckResult =
  | { status: 'connected' }
  | { status: 'error'; message: string };

export class ConnectivityService {
  constructor(private readonly deps: ConnectivityServiceDeps) {}

  async checkAllSources(): Promise<void> {
    const { openSourcesDb, logger } = this.deps;
    const db = openSourcesDb();
    const rows = db.prepare('SELECT id, kind, config FROM sources').all() as SourceRecord[];

    for (const row of rows) {
      try {
        await this.checkSource(row.id);
      } catch (error) {
        logger.warn('Connectivity check failed', { sourceId: row.id, error });
      }
    }
  }

  listSourceIds(): string[] {
    const db = this.deps.openSourcesDb();
    const rows = db.prepare('SELECT id FROM sources').all() as Array<{ id: string }>;
    return rows.map((row) => row.id);
  }

  async checkSource(sourceId: string): Promise<ConnectivityCheckResult> {
    const {
      openSourcesDb,
      retrieveSecret,
      audit,
      logger,
    } = this.deps;

    const db = openSourcesDb();
    const row = db
      .prepare('SELECT id, kind, config FROM sources WHERE id = ?')
      .get(sourceId) as SourceRecord | undefined;

    if (!row) {
      logger.warn('Source not found during connectivity check', { sourceId });
      return { status: 'error', message: 'Source not found' } satisfies ConnectivityCheckResult;
    }

    const config = JSON.parse(row.config ?? '{}') as { connection?: Record<string, unknown> };

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
      return { status: 'connected' } satisfies ConnectivityCheckResult;
    } catch (error) {
      const message = (error as Error).message ?? 'Unknown connection error';
      sourceService.setConnectionStatus(sourceId, 'error', message);
      audit({
        action: 'connectivity.check.failed',
        sourceId,
        status: 'failure',
        details: { error: message },
      });
      return { status: 'error', message } satisfies ConnectivityCheckResult;
    }
  }

  private async enrichConnection(
    kind: SourceRecord['kind'],
    connection: Record<string, unknown>,
    sourceId: string,
    retrieveSecret: ConnectivityServiceDeps['retrieveSecret'],
  ) {
    if (kind === 'postgres' || kind === 'mysql') {
      const password = await retrieveSecret({ sourceId, key: 'password' });
      if (password) {
        connection.password = password;
      }
      return connection as PostgresConnection | MySqlConnection;
    }

    if (kind === 'mongo') {
      const uri = await retrieveSecret({ sourceId, key: 'uri' });
      if (uri) {
        connection.uri = uri;
      }
      return connection as MongoConnection;
    }

    return {
      filePath: (connection as { filePath?: string }).filePath ?? '',
    } satisfies DuckDbConnection;
  }

  private async testConnection(kind: SourceRecord['kind'], connection: Record<string, unknown>) {
    switch (kind) {
      case 'postgres': {
        const adapter = new PostgresAdapter({ connection: connection as PostgresConnection });
        await adapter.healthCheck();
        await adapter.close();
        break;
      }
      case 'mysql': {
        const adapter = new MysqlAdapter({ connection: connection as MySqlConnection });
        await adapter.healthCheck();
        await adapter.close();
        break;
      }
      case 'mongo': {
        const adapter = new MongoAdapter({ connection: connection as MongoConnection });
        await adapter.healthCheck();
        await adapter.close();
        break;
      }
      case 'duckdb': {
        const adapter = new DuckDbAdapter({ connection: { ...connection as DuckDbConnection, readOnly: false } });
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

type ConnectionStatusUi = {
  status: 'connecting' | 'queued' | 'ready' | 'error' | 'needs_attention';
  error?: { message: string; meta?: Record<string, unknown> };
};

type MapStatusFn = (
  status: 'unknown' | 'checking' | 'connected' | 'error',
  error?: { message: string },
) => ConnectionStatusUi;

interface ConnectivityQueueDeps {
  service: ConnectivityService;
  broadcastStatus: (sourceId: string, payload: ConnectionStatusUi) => void;
  mapStatus: MapStatusFn;
  logger: ConnectivityServiceDeps['logger'];
}

export class ConnectivityQueue {
  private readonly queue: string[] = [];
  private readonly pending = new Set<string>();
  private running = false;

  constructor(private readonly deps: ConnectivityQueueDeps) {}

  queueCheck(sourceId: string): { queued: boolean } {
    if (this.pending.has(sourceId)) {
      this.deps.logger.info('Connectivity check already queued', { sourceId });
      return { queued: false };
    }

    this.pending.add(sourceId);
    this.deps.broadcastStatus(sourceId, this.deps.mapStatus('checking'));
    this.queue.push(sourceId);
    void this.processQueue();
    return { queued: true };
  }

  async queueStartupSweep(): Promise<number> {
    const ids = this.deps.service.listSourceIds();
    let queuedCount = 0;
    for (const id of ids) {
      const result = this.queueCheck(id);
      if (result.queued) {
        queuedCount += 1;
      }
    }
    return queuedCount;
  }

  private async processQueue(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    while (this.queue.length > 0) {
      const sourceId = this.queue.shift();
      if (!sourceId) {
        continue;
      }

      this.deps.broadcastStatus(sourceId, this.deps.mapStatus('checking'));

      try {
        const result = await this.deps.service.checkSource(sourceId);
        if (result.status === 'connected') {
          this.deps.broadcastStatus(sourceId, this.deps.mapStatus('connected'));
        } else {
          this.deps.broadcastStatus(sourceId, this.deps.mapStatus('error', { message: result.message }));
        }
      } catch (error) {
        const message = (error as Error).message ?? 'Unknown connectivity error';
        this.deps.logger.error('Connectivity check failed unexpectedly', { sourceId, error });
        this.deps.broadcastStatus(sourceId, this.deps.mapStatus('error', { message }));
      } finally {
        this.pending.delete(sourceId);
      }
    }

    this.running = false;
  }
}
