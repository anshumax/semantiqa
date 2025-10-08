import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { persistMysqlSnapshot } from '../../src/persistence/mysql';

describe('persistMysqlSnapshot', () => {
  it('persists MySQL tables and columns into nodes and edges', () => {
    const db = new Database(':memory:');

    db.exec(`
      CREATE TABLE nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        props TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    db.exec(`
      CREATE TABLE edges (
        id TEXT PRIMARY KEY,
        src_id TEXT NOT NULL,
        dst_id TEXT NOT NULL,
        type TEXT NOT NULL,
        props TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    persistMysqlSnapshot(db, {
      tables: [
        {
          schema: 'analytics',
          name: 'accounts',
          type: 'BASE TABLE',
          comment: 'Account table',
          columns: [
            {
              name: 'id',
              type: 'char',
              nullable: false,
              defaultValue: null,
              comment: 'Primary key',
            },
          ],
        },
      ],
    });

    const nodes = db.prepare('SELECT * FROM nodes ORDER BY id').all();
    const edges = db.prepare('SELECT * FROM edges ORDER BY id').all();

    expect(nodes).toHaveLength(2);
    expect(nodes[0].id).toBe('mysql.analytics.accounts');
    expect(nodes[1].id).toBe('mysql.analytics.accounts.id');

    expect(edges).toHaveLength(1);
    expect(edges[0].src_id).toBe('mysql.analytics.accounts.id');
    expect(edges[0].dst_id).toBe('mysql.analytics.accounts');
  });
});


