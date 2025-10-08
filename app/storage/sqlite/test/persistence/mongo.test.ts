import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { persistMongoSnapshot } from '../../src/persistence/mongo';

describe('persistMongoSnapshot', () => {
  it('persists collections and fields into nodes and edges', () => {
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

    persistMongoSnapshot(db, {
      collections: [
        {
          name: 'accounts',
          documentSampleSize: 10,
          fields: [
            { path: 'name', types: ['string'], nullable: false },
            { path: 'preferences.theme', types: ['string'], nullable: true },
          ],
        },
      ],
    });

    const nodes = db.prepare('SELECT id, type FROM nodes ORDER BY id').all();
    expect(nodes).toEqual([
      { id: 'mongo.accounts', type: 'collection' },
      { id: 'mongo.accounts.name', type: 'field' },
      { id: 'mongo.accounts.preferences.theme', type: 'field' },
    ]);

    const edges = db.prepare('SELECT src_id, dst_id FROM edges ORDER BY src_id').all();
    expect(edges).toEqual([
      { src_id: 'mongo.accounts.name', dst_id: 'mongo.accounts' },
      { src_id: 'mongo.accounts.preferences.theme', dst_id: 'mongo.accounts' },
    ]);
  });
});


