import path from 'node:path';

import { DatabaseService } from '../DatabaseService';

function resolveDbPath() {
  return process.env.SEMANTIQA_DB_PATH ?? path.resolve(process.cwd(), 'semantiqa.db');
}

export function migrate() {
  const dbPath = resolveDbPath();
  // Initialize DatabaseService which will create schema if needed
  DatabaseService.getInstance(dbPath);
  console.log('Database schema initialized');
}

if (require.main === module) {
  migrate();
}

