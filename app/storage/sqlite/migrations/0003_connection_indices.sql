BEGIN TRANSACTION;

-- Add indices to improve performance of duplicate connection detection
-- These indices will speed up the JSON extraction queries used in findExistingConnection

-- Index for PostgreSQL/MySQL connections on host, port, and database
CREATE INDEX IF NOT EXISTS idx_sources_pg_mysql_connection ON sources(
  kind,
  json_extract(config, '$.connection.host'),
  json_extract(config, '$.connection.port'),
  json_extract(config, '$.connection.database')
) WHERE kind IN ('postgres', 'mysql');

-- Index for MongoDB connections on database name
CREATE INDEX IF NOT EXISTS idx_sources_mongo_connection ON sources(
  kind,
  json_extract(config, '$.connection.database')
) WHERE kind = 'mongo';

-- Index for DuckDB connections on file path
CREATE INDEX IF NOT EXISTS idx_sources_duckdb_connection ON sources(
  kind,
  json_extract(config, '$.connection.filePath')
) WHERE kind = 'duckdb';

COMMIT;