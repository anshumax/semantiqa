import type BetterSqlite3 from 'better-sqlite3';
import DatabaseConstructor from 'better-sqlite3';

export type SqliteFactoryOptions = {
  readonly dbPath: string;
};

export function createSqliteFactory(options: SqliteFactoryOptions): () => BetterSqlite3.Database {
  let instance: BetterSqlite3.Database | null = null;

  return () => {
    if (!instance) {
      instance = new DatabaseConstructor(options.dbPath, { readonly: false });
    }

    return instance;
  };
}


