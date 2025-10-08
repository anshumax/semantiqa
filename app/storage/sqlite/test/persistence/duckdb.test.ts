import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { persistDuckDbSnapshot } from '../../src/persistence/duckdb';

describe('persistDuckDbSnapshot', () => {
  it('persists tables and columns into nodes and edges', () => {
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

    persistDuckDbSnapshot(db, {
      tables: [
        {
          name: 'accounts',
          type: 'TABLE',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false },
            { name: 'name', type: 'VARCHAR', nullable: true },
          ],
        },
      ],
    });

    const nodes = db.prepare('SELECT id, type FROM nodes ORDER BY id').all();
    expect(nodes).toEqual([
      { id: 'duckdb.accounts', type: 'table' },
      { id: 'duckdb.accounts.id', type: 'column' },
      { id: 'duckdb.accounts.name', type: 'column' },
    ]);

    const edges = db.prepare('SELECT src_id, dst_id FROM edges ORDER BY src_id').all();
    expect(edges).toEqual([
      { src_id: 'duckdb.accounts.id', dst_id: 'duckdb.accounts' },
      { src_id: 'duckdb.accounts.name', dst_id: 'duckdb.accounts' },
    ]);
  });
});


