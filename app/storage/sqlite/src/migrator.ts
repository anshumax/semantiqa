import fs from 'node:fs';
import path from 'node:path';

import type BetterSqlite3 from 'better-sqlite3';

let Sqlite: typeof BetterSqlite3 | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Candidate = require('better-sqlite3') as typeof BetterSqlite3;
  const probe = new Candidate(':memory:');
  probe.close();
  Sqlite = Candidate;
} catch {
  Sqlite = null;
}

export const sqliteAvailable = Sqlite !== null;

export interface Migration {
  id: string;
  filepath: string;
  checksum: string;
  sql: string;
}

export interface MigrationResult {
  applied: string[];
}

const MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS migrations (
  id TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL
)`;

function calculateChecksum(sql: string) {
  return require('node:crypto').createHash('sha256').update(sql).digest('hex');
}

export function loadMigrations(dir: string): Migration[] {
  const filenames = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  return filenames.map((filename) => {
    const filepath = path.join(dir, filename);
    const sql = fs.readFileSync(filepath, 'utf8');
    const checksum = calculateChecksum(sql);
    return {
      id: filename,
      filepath,
      checksum,
      sql,
    } satisfies Migration;
  });
}

export function runMigrations(dbPath: string, migrationsDir: string): MigrationResult {
  if (!Sqlite) {
    return { applied: [] };
  }

  const db = new Sqlite(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(MIGRATIONS_TABLE);

  const appliedStmt = db.prepare('SELECT id, checksum FROM migrations ORDER BY id');
  const appliedRows = appliedStmt.all() as Array<{ id: string; checksum: string }>;
  const appliedMap = new Map<string, string>(appliedRows.map((row) => [row.id, row.checksum]));

  const migrations = loadMigrations(migrationsDir);
  const applied: string[] = [];

  const insertMigration = db.prepare(
    'INSERT INTO migrations (id, checksum, applied_at) VALUES (@id, @checksum, @applied_at)',
  );

  const applyMigration = db.transaction((migration: Migration) => {
    db.exec(migration.sql);
    insertMigration.run({
      id: migration.id,
      checksum: migration.checksum,
      applied_at: new Date().toISOString(),
    });
  });

  for (const migration of migrations) {
    const existingChecksum = appliedMap.get(migration.id);
    if (existingChecksum === migration.checksum) {
      continue;
    }

    if (existingChecksum && existingChecksum !== migration.checksum) {
      throw new Error(
        `Checksum mismatch for migration ${migration.id}. Expected ${existingChecksum}, found ${migration.checksum}.`,
      );
    }

    applyMigration(migration);
    applied.push(migration.id);
  }

  db.close();

  return { applied };
}

