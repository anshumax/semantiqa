DROP TABLE IF EXISTS nodes;
DROP TABLE IF EXISTS edges;
DROP TABLE IF EXISTS docs;
DROP TABLE IF EXISTS embeddings;
DROP TABLE IF EXISTS provenance;
DROP TABLE IF EXISTS changelog;
DROP TABLE IF EXISTS models;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS sources;

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  props JSON NOT NULL,
  owner_ids JSON,
  tags JSON,
  sensitivity TEXT,
  status TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  origin_device_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
CREATE INDEX IF NOT EXISTS idx_nodes_updated_at ON nodes(updated_at);

CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,
  src_id TEXT NOT NULL,
  dst_id TEXT NOT NULL,
  type TEXT NOT NULL,
  props JSON,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  origin_device_id TEXT,
  UNIQUE (src_id, dst_id, type)
);

CREATE INDEX IF NOT EXISTS idx_edges_src_type ON edges(src_id, type);
CREATE INDEX IF NOT EXISTS idx_edges_dst_type ON edges(dst_id, type);

CREATE TABLE IF NOT EXISTS docs (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  ydoc BLOB NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS embeddings (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  vec BLOB NOT NULL,
  dim INTEGER NOT NULL,
  model TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (owner_type, owner_id)
);

CREATE TABLE IF NOT EXISTS provenance (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  ref TEXT,
  meta JSON,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS changelog (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  op TEXT NOT NULL,
  patch JSON,
  ts TEXT DEFAULT CURRENT_TIMESTAMP,
  origin_device_id TEXT
);

CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  size_mb INTEGER NOT NULL,
  path TEXT,
  sha256 TEXT,
  enabled_tasks JSON,
  installed_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSON NOT NULL
);

CREATE TABLE IF NOT EXISTS sources (
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
);

COMMIT;

