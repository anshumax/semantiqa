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

export function initializeSchema(dbPath: string): void {
  if (!Sqlite) {
    console.warn('SQLite not available, skipping schema initialization');
    return;
  }

  const db = new Sqlite(dbPath);
  db.pragma('journal_mode = WAL');

  console.log('Initializing database schema...');

  // Create nodes table
  db.exec(`CREATE TABLE IF NOT EXISTS nodes (
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
  )`);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_nodes_updated_at ON nodes(updated_at)`);

  // Create edges table
  db.exec(`CREATE TABLE IF NOT EXISTS edges (
    id TEXT PRIMARY KEY,
    src_id TEXT NOT NULL,
    dst_id TEXT NOT NULL,
    type TEXT NOT NULL,
    props JSON,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    origin_device_id TEXT,
    UNIQUE (src_id, dst_id, type)
  )`);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_edges_src_type ON edges(src_id, type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_edges_dst_type ON edges(dst_id, type)`);

  // Create docs table
  db.exec(`CREATE TABLE IF NOT EXISTS docs (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    ydoc BLOB NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create embeddings table
  db.exec(`CREATE TABLE IF NOT EXISTS embeddings (
    id TEXT PRIMARY KEY,
    owner_type TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    vec BLOB NOT NULL,
    dim INTEGER NOT NULL,
    model TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (owner_type, owner_id)
  )`);

  // Create provenance table
  db.exec(`CREATE TABLE IF NOT EXISTS provenance (
    id TEXT PRIMARY KEY,
    owner_type TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    ref TEXT,
    meta JSON,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create changelog table
  db.exec(`CREATE TABLE IF NOT EXISTS changelog (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    actor TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    op TEXT NOT NULL,
    patch JSON,
    ts TEXT DEFAULT CURRENT_TIMESTAMP,
    origin_device_id TEXT
  )`);

  // Create models table
  db.exec(`CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    size_mb INTEGER NOT NULL,
    path TEXT,
    sha256 TEXT,
    enabled_tasks JSON,
    installed_at TEXT,
    updated_at TEXT
  )`);

  // Create settings table
  db.exec(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSON NOT NULL
  )`);

  // Create sources table
  db.exec(`CREATE TABLE IF NOT EXISTS sources (
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
  )`);

  // Add indices for connection deduplication and performance
  // Index for PostgreSQL/MySQL connections on host, port, and database
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sources_pg_mysql_connection ON sources(
    kind,
    json_extract(config, '$.connection.host'),
    json_extract(config, '$.connection.port'),
    json_extract(config, '$.connection.database')
  ) WHERE kind IN ('postgres', 'mysql')`);

  // Index for MongoDB connections on database name
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sources_mongo_connection ON sources(
    kind,
    json_extract(config, '$.connection.database')
  ) WHERE kind = 'mongo'`);

  // Index for DuckDB connections on file path
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sources_duckdb_connection ON sources(
    kind,
    json_extract(config, '$.connection.filePath')
  ) WHERE kind = 'duckdb'`);

  // Canvas tables for the new canvas-based UI
  
  // Canvas metadata and global state
  db.exec(`CREATE TABLE IF NOT EXISTS canvas_state (
    id TEXT PRIMARY KEY DEFAULT 'default',
    name TEXT NOT NULL DEFAULT 'Main Canvas',
    description TEXT,
    viewport_zoom REAL NOT NULL DEFAULT 1.0,
    viewport_center_x REAL NOT NULL DEFAULT 0.0,
    viewport_center_y REAL NOT NULL DEFAULT 0.0,
    grid_size INTEGER DEFAULT 20,
    snap_to_grid BOOLEAN DEFAULT TRUE,
    auto_save BOOLEAN DEFAULT TRUE,
    theme TEXT DEFAULT 'dark',
    canvas_version TEXT NOT NULL DEFAULT '2.1',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_saved_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  // Insert default canvas state
  db.exec(`INSERT OR IGNORE INTO canvas_state (id) VALUES ('default')`);

  // Canvas blocks representing data sources
  db.exec(`CREATE TABLE IF NOT EXISTS canvas_blocks (
    id TEXT PRIMARY KEY,
    canvas_id TEXT NOT NULL DEFAULT 'default',
    source_id TEXT NOT NULL,
    position_x REAL NOT NULL,
    position_y REAL NOT NULL,
    width REAL DEFAULT 200.0,
    height REAL DEFAULT 120.0,
    z_index INTEGER DEFAULT 0,
    color_theme TEXT DEFAULT 'auto',
    is_selected BOOLEAN DEFAULT FALSE,
    is_minimized BOOLEAN DEFAULT FALSE,
    custom_title TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (canvas_id) REFERENCES canvas_state(id) ON DELETE CASCADE,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
    UNIQUE(canvas_id, source_id)
  )`);

  // Canvas relationships with visual properties
  db.exec(`CREATE TABLE IF NOT EXISTS canvas_relationships (
    id TEXT PRIMARY KEY,
    canvas_id TEXT NOT NULL DEFAULT 'default',
    source_block_id TEXT NOT NULL,
    target_block_id TEXT NOT NULL,
    source_table_name TEXT NOT NULL,
    source_column_name TEXT NOT NULL,
    target_table_name TEXT NOT NULL,
    target_column_name TEXT NOT NULL,
    relationship_type TEXT NOT NULL DEFAULT 'semantic_link',
    confidence_score REAL DEFAULT 1.0,
    visual_style TEXT DEFAULT 'solid',
    line_color TEXT DEFAULT '#8bb4f7',
    line_width REAL DEFAULT 2.0,
    curve_path TEXT,
    is_intra_source BOOLEAN DEFAULT FALSE,
    is_selected BOOLEAN DEFAULT FALSE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (canvas_id) REFERENCES canvas_state(id) ON DELETE CASCADE,
    FOREIGN KEY (source_block_id) REFERENCES canvas_blocks(id) ON DELETE CASCADE,
    FOREIGN KEY (target_block_id) REFERENCES canvas_blocks(id) ON DELETE CASCADE
  )`);

  // Semantic relationships table for canvas integration
  db.exec(`CREATE TABLE IF NOT EXISTS semantic_relationships (
    id TEXT PRIMARY KEY,
    source_node_id TEXT NOT NULL,
    target_node_id TEXT NOT NULL,
    source_field_path TEXT NOT NULL,
    target_field_path TEXT NOT NULL,
    relationship_type TEXT NOT NULL DEFAULT 'semantic_link',
    confidence_score REAL NOT NULL DEFAULT 0.0,
    detection_method TEXT NOT NULL DEFAULT 'manual',
    validation_status TEXT DEFAULT 'unvalidated',
    metadata JSON,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (target_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
    UNIQUE(source_node_id, target_node_id, source_field_path, target_field_path)
  )`);

  // Create indices for canvas tables
  db.exec(`CREATE INDEX IF NOT EXISTS idx_canvas_blocks_canvas ON canvas_blocks(canvas_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_canvas_blocks_source ON canvas_blocks(source_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_canvas_blocks_position ON canvas_blocks(canvas_id, position_x, position_y)`);
  
  db.exec(`CREATE INDEX IF NOT EXISTS idx_canvas_relationships_canvas ON canvas_relationships(canvas_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_canvas_relationships_source_block ON canvas_relationships(source_block_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_canvas_relationships_target_block ON canvas_relationships(target_block_id)`);
  
  db.exec(`CREATE INDEX IF NOT EXISTS idx_semantic_relationships_source ON semantic_relationships(source_node_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_semantic_relationships_target ON semantic_relationships(target_node_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_semantic_relationships_confidence ON semantic_relationships(confidence_score)`);

  db.close();
  console.log('Database schema initialized successfully');
}

