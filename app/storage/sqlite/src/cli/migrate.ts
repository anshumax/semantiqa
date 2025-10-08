import path from 'node:path';

import { runMigrations } from '../migrator';

function resolveDbPath() {
  return process.env.SEMANTIQA_DB_PATH ?? path.resolve(process.cwd(), 'semantiqa.db');
}

function resolveMigrationsDir() {
  return (
    process.env.SEMANTIQA_MIGRATIONS_DIR ?? path.resolve(__dirname, '..', '..', 'migrations')
  );
}

export function migrate() {
  const dbPath = resolveDbPath();
  const migrationsDir = resolveMigrationsDir();
  const result = runMigrations(dbPath, migrationsDir);
  console.log(`Applied ${result.applied.length} migrations`);
}

if (require.main === module) {
  migrate();
}

