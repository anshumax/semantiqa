import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadMigrations, runMigrations, sqliteAvailable } from '../src/migrator';

const tempDirs: string[] = [];

function createTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'semantiqa-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

const itSqlite = sqliteAvailable ? it : it.skip;

describe('migrator', () => {
  it('loads migrations in sorted order', () => {
    const dir = createTempDir();
    fs.writeFileSync(path.join(dir, '0002.sql'), 'SELECT 2;');
    fs.writeFileSync(path.join(dir, '0001.sql'), 'SELECT 1;');

    const migrations = loadMigrations(dir);
    expect(migrations.map((m) => m.id)).toEqual(['0001.sql', '0002.sql']);
  });

  itSqlite('applies migrations and records metadata', () => {
    if (!sqliteAvailable) {
      return;
    }

    const targetDir = createTempDir();
    const dbPath = path.join(targetDir, 'test.db');
    const migrationsDir = createTempDir();

    fs.writeFileSync(
      path.join(migrationsDir, '0001.sql'),
      'CREATE TABLE example (id TEXT PRIMARY KEY);',
    );

    const result = runMigrations(dbPath, migrationsDir);
    expect(result.applied).toEqual(['0001.sql']);

    const db = new (require('better-sqlite3') as typeof import('better-sqlite3'))(dbPath);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    expect(tables.map((t: { name: string }) => t.name)).toContain('example');
    const migrationRow = db.prepare('SELECT id FROM migrations WHERE id = ?').get('0001.sql');
    expect(migrationRow).toEqual({ id: '0001.sql' });
    db.close();
  });
});

