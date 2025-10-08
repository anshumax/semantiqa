import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import type { PostgresSchemaSnapshot } from '../../src/persistence/postgres';
import { persistPostgresSnapshot } from '../../src/persistence/postgres';

describe('persistPostgresSnapshot', () => {
  it('writes tables and columns to nodes table', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE nodes (
        id TEXT PRIMARY KEY,
        type TEXT,
        props JSON,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE edges (
        id TEXT PRIMARY KEY,
        src_id TEXT,
        dst_id TEXT,
        type TEXT,
        props JSON,
        created_at TEXT,
        updated_at TEXT
      );
    `);

    const snapshot: PostgresSchemaSnapshot = {
      tables: [
        {
          schema: 'public',
          name: 'accounts',
          type: 'BASE TABLE',
          comment: 'Account table',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              nullable: false,
              defaultValue: null,
              comment: 'Primary key',
            },
          ],
        },
      ],
    };

    persistPostgresSnapshot(db, snapshot);

    const nodes = db.prepare('SELECT id FROM nodes ORDER BY id').all();
    expect(nodes).toEqual([
      { id: 'pg.public.accounts' },
      { id: 'pg.public.accounts.id' },
    ]);

    const edges = db.prepare('SELECT src_id, dst_id FROM edges').all();
    expect(edges).toEqual([
      { src_id: 'pg.public.accounts.id', dst_id: 'pg.public.accounts' },
    ]);

    db.close();
  });
});

