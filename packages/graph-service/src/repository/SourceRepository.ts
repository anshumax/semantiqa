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

  addSource(payload: SourcesAddRequest, sourceId: string): { sourceId: string } {
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
    }>(
      `INSERT INTO sources (id, name, kind, config, owners, tags)
       VALUES (@id, @name, @kind, json(@config), json(@owners), json(@tags))`,
    );

    const transaction = this.db.transaction(() => {
      insertSource.run({
        id: sourceId,
        name: payload.name,
        kind: payload.kind,
        config: JSON.stringify(config),
        owners: JSON.stringify(owners),
        tags: JSON.stringify(tags),
      });
    });

    transaction();

    return { sourceId };
  }

  removeSource(sourceId: string): void {
    const transaction = this.db.transaction(() => {
      this.db.prepare('DELETE FROM sources WHERE id = ?').run(sourceId);
    });

    transaction();
  }
}

