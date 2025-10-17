import BetterSqlite3 from 'better-sqlite3';
import { SourceRepository } from '../src/repository/SourceRepository';
import type { SourcesAddRequest } from '@semantiqa/contracts';

describe('SourceRepository duplicate detection', () => {
  let db: BetterSqlite3.Database;
  let repository: SourceRepository;

  beforeEach(() => {
    db = new BetterSqlite3(':memory:');
    
    // Create sources table
    db.exec(`
      CREATE TABLE sources (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        config JSON NOT NULL,
        owners JSON,
        tags JSON,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        status TEXT NOT NULL DEFAULT 'not_crawled',
        status_updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_crawl_at TEXT,
        last_error TEXT,
        last_error_meta JSON,
        connection_status TEXT NOT NULL DEFAULT 'unknown',
        last_connected_at TEXT,
        last_connection_error TEXT
      )
    `);

    repository = new SourceRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('PostgreSQL connections', () => {
    const postgresRequest: SourcesAddRequest = {
      kind: 'postgres',
      name: 'Test PostgreSQL',
      connection: {
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        user: 'testuser',
        password: 'testpass',
      },
    };

    it('should detect duplicate PostgreSQL connections', () => {
      // Add first source
      const result1 = repository.addSource(postgresRequest, 'src_postgres_1');
      expect(result1.sourceId).toBe('src_postgres_1');

      // Try to add duplicate - should find existing
      const existing = repository.findExistingConnection(postgresRequest);
      expect(existing).not.toBeNull();
      expect(existing?.name).toBe('Test PostgreSQL');
      expect(existing?.id).toBe('src_postgres_1');
    });

    it('should throw error when adding duplicate PostgreSQL connection', () => {
      // Add first source
      repository.addSource(postgresRequest, 'src_postgres_1');

      // Try to add duplicate - should throw
      expect(() => {
        repository.addSource(postgresRequest, 'src_postgres_2');
      }).toThrow('A source with the same connection already exists');
    });

    it('should allow different PostgreSQL connections', () => {
      // Add first source
      repository.addSource(postgresRequest, 'src_postgres_1');

      // Add different connection (different port)
      const differentRequest: SourcesAddRequest = {
        ...postgresRequest,
        name: 'Different PostgreSQL',
        connection: {
          ...postgresRequest.connection,
          port: 5433,
        },
      };

      const existing = repository.findExistingConnection(differentRequest);
      expect(existing).toBeNull();

      const result = repository.addSource(differentRequest, 'src_postgres_2');
      expect(result.sourceId).toBe('src_postgres_2');
    });
  });

  describe('MySQL connections', () => {
    const mysqlRequest: SourcesAddRequest = {
      kind: 'mysql',
      name: 'Test MySQL',
      connection: {
        host: 'localhost',
        port: 3306,
        database: 'testdb',
        user: 'testuser',
        password: 'testpass',
      },
    };

    it('should detect duplicate MySQL connections', () => {
      repository.addSource(mysqlRequest, 'src_mysql_1');

      const existing = repository.findExistingConnection(mysqlRequest);
      expect(existing).not.toBeNull();
      expect(existing?.name).toBe('Test MySQL');
    });
  });

  describe('MongoDB connections', () => {
    const mongoRequest: SourcesAddRequest = {
      kind: 'mongo',
      name: 'Test MongoDB',
      connection: {
        uri: 'mongodb://user:pass@localhost:27017/testdb',
        database: 'testdb',
      },
    };

    it('should detect duplicate MongoDB connections based on database', () => {
      repository.addSource(mongoRequest, 'src_mongo_1');

      const existing = repository.findExistingConnection(mongoRequest);
      expect(existing).not.toBeNull();
      expect(existing?.name).toBe('Test MongoDB');
    });

    it('should allow different MongoDB databases', () => {
      repository.addSource(mongoRequest, 'src_mongo_1');

      const differentRequest: SourcesAddRequest = {
        ...mongoRequest,
        name: 'Different MongoDB',
        connection: {
          ...mongoRequest.connection,
          database: 'differentdb',
        },
      };

      const existing = repository.findExistingConnection(differentRequest);
      expect(existing).toBeNull();
    });
  });

  describe('DuckDB connections', () => {
    const duckdbRequest: SourcesAddRequest = {
      kind: 'duckdb',
      name: 'Test DuckDB',
      connection: {
        filePath: '/path/to/database.duckdb',
      },
    };

    it('should detect duplicate DuckDB connections based on file path', () => {
      repository.addSource(duckdbRequest, 'src_duckdb_1');

      const existing = repository.findExistingConnection(duckdbRequest);
      expect(existing).not.toBeNull();
      expect(existing?.name).toBe('Test DuckDB');
    });

    it('should allow different DuckDB file paths', () => {
      repository.addSource(duckdbRequest, 'src_duckdb_1');

      const differentRequest: SourcesAddRequest = {
        ...duckdbRequest,
        name: 'Different DuckDB',
        connection: {
          filePath: '/path/to/other-database.duckdb',
        },
      };

      const existing = repository.findExistingConnection(differentRequest);
      expect(existing).toBeNull();
    });
  });
});