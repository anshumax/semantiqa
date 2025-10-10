import path from 'node:path';

import { initializeSchema } from '../migrator';

function resolveDbPath() {
  return process.env.SEMANTIQA_DB_PATH ?? path.resolve(process.cwd(), 'semantiqa.db');
}

export function migrate() {
  const dbPath = resolveDbPath();
  initializeSchema(dbPath);
  console.log('Database schema initialized');
}

if (require.main === module) {
  migrate();
}

