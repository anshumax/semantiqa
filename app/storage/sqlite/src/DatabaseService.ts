import type BetterSqlite3 from 'better-sqlite3';
import DatabaseConstructor from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Centralized Database Service
 * 
 * Provides a single, managed SQLite database connection for the entire application.
 * Handles database file creation, schema initialization, and connection lifecycle.
 * 
 * Usage:
 *   const db = DatabaseService.getInstance(dbPath);
 *   const connection = db.getConnection();
 */
export class DatabaseService {
  private static instance: DatabaseService | null = null;
  private db: BetterSqlite3.Database | null = null;
  private readonly dbPath: string;
  private isInitialized: boolean = false;

  private constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /**
   * Get the singleton instance of DatabaseService
   */
  public static getInstance(dbPath: string): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService(dbPath);
    }
    return DatabaseService.instance;
  }

  /**
   * Get the database connection, initializing if necessary
   */
  public getConnection(): BetterSqlite3.Database {
    if (!this.db) {
      this.initialize();
    }
    return this.db!;
  }

  /**
   * Initialize the database: create file, open connection, set pragmas, create schema
   */
  private initialize(): void {
    if (this.isInitialized) {
      return;
    }

    console.log('🗄️ Initializing database:', this.dbPath);

    const dbFileExists = fs.existsSync(this.dbPath);
    console.log('🗄️ Database file exists:', dbFileExists);

    // Open database connection
    this.db = new DatabaseConstructor(this.dbPath, { 
      readonly: false 
    });

    // Set pragmas for optimal performance and reliability
    this.db.pragma('locking_mode = EXCLUSIVE');
    this.db.pragma('journal_mode = DELETE');
    this.db.pragma('synchronous = FULL');
    this.db.pragma('foreign_keys = ON');

    // Check if schema exists
    const tablesCheck = this.db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN ('sources', 'nodes', 'edges')
    `).all();

    const hasRequiredTables = tablesCheck.length >= 3;
    console.log('🗄️ Database has core tables:', hasRequiredTables);
    
    // Log data counts on startup
    if (hasRequiredTables) {
      try {
        const blockCount = this.db.prepare('SELECT COUNT(*) as count FROM canvas_source_blocks').get() as { count: number };
        const relCount = this.db.prepare('SELECT COUNT(*) as count FROM canvas_relationships').get() as { count: number };
        console.log('📊 STARTUP: Existing data found - blocks:', blockCount.count, 'relationships:', relCount.count);
      } catch (error) {
        console.log('📊 STARTUP: Could not count canvas data (tables may not exist yet)');
      }
    }

    if (!hasRequiredTables) {
      console.log('🗄️ Creating database schema...');
      this.createSchema();
      console.log('✅ Database schema created successfully');
    } else {
      console.log('✅ Database schema already exists');
    }

    this.isInitialized = true;
  }

  /**
   * Create all database tables
   */
  private createSchema(): void {
    if (!this.db) {
      throw new Error('Database connection not initialized');
    }

    // Core graph tables
    this.db.exec(`CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      props TEXT NOT NULL,
      owner_ids TEXT,
      tags TEXT,
      sensitivity TEXT,
      status TEXT DEFAULT 'active',
      origin_device_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status)`);

    this.db.exec(`CREATE TABLE IF NOT EXISTS edges (
      id TEXT PRIMARY KEY,
      src_id TEXT NOT NULL,
      dst_id TEXT NOT NULL,
      type TEXT NOT NULL,
      props TEXT,
      origin_device_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (src_id) REFERENCES nodes(id) ON DELETE CASCADE,
      FOREIGN KEY (dst_id) REFERENCES nodes(id) ON DELETE CASCADE
    )`);

    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_edges_src ON edges(src_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_edges_dst ON edges(dst_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(type)`);

    this.db.exec(`CREATE TABLE IF NOT EXISTS docs (
      id TEXT PRIMARY KEY,
      body TEXT NOT NULL,
      meta TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    this.db.exec(`CREATE TABLE IF NOT EXISTS embeddings (
      id TEXT PRIMARY KEY,
      owner_type TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      vec BLOB NOT NULL,
      dim INTEGER NOT NULL,
      model TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (owner_type, owner_id)
    )`);

    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_embeddings_owner ON embeddings(owner_type, owner_id)`);

    this.db.exec(`CREATE TABLE IF NOT EXISTS provenance (
      id TEXT PRIMARY KEY,
      owner_type TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      ref TEXT,
      meta TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_provenance_owner ON provenance(owner_type, owner_id)`);

    this.db.exec(`CREATE TABLE IF NOT EXISTS changelog (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      changes TEXT NOT NULL,
      device_id TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_changelog_timestamp ON changelog(timestamp)`);

    this.db.exec(`CREATE TABLE IF NOT EXISTS models (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      provider TEXT,
      config TEXT,
      status TEXT DEFAULT 'available',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    this.db.exec(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    this.db.exec(`CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      config TEXT NOT NULL,
      description TEXT,
      owners TEXT,
      tags TEXT,
      connection_status TEXT DEFAULT 'unknown',
      status TEXT DEFAULT 'pending',
      status_updated_at TEXT,
      last_crawl_at TEXT,
      last_connected_at TEXT,
      last_error TEXT,
      last_error_meta TEXT,
      last_connection_error TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_sources_kind ON sources(kind)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_sources_status ON sources(status)`);

    // Canvas tables
    this.db.exec(`CREATE TABLE IF NOT EXISTS canvas_state (
      id TEXT PRIMARY KEY DEFAULT 'default',
      name TEXT NOT NULL DEFAULT 'Main Canvas',
      description TEXT,
      viewport_zoom REAL DEFAULT 1.0,
      viewport_center_x REAL DEFAULT 0,
      viewport_center_y REAL DEFAULT 0,
      grid_size INTEGER DEFAULT 20,
      snap_to_grid BOOLEAN DEFAULT TRUE,
      auto_save BOOLEAN DEFAULT TRUE,
      theme TEXT DEFAULT 'dark',
      canvas_version TEXT DEFAULT '1.0.0',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_saved_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    this.db.exec(`CREATE TABLE IF NOT EXISTS canvas_source_blocks (
      id TEXT PRIMARY KEY,
      canvas_id TEXT NOT NULL DEFAULT 'default',
      source_id TEXT NOT NULL,
      position_x REAL NOT NULL,
      position_y REAL NOT NULL,
      width REAL DEFAULT 200,
      height REAL DEFAULT 120,
      z_index INTEGER DEFAULT 0,
      color_theme TEXT DEFAULT 'auto',
      is_selected BOOLEAN DEFAULT FALSE,
      is_minimized BOOLEAN DEFAULT FALSE,
      custom_title TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (canvas_id) REFERENCES canvas_state(id) ON DELETE CASCADE,
      FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
      UNIQUE (canvas_id, source_id)
    )`);

    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_canvas_source_blocks_canvas ON canvas_source_blocks(canvas_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_canvas_source_blocks_source ON canvas_source_blocks(source_id)`);

    this.db.exec(`CREATE TABLE IF NOT EXISTS canvas_table_blocks (
      id TEXT PRIMARY KEY,
      canvas_id TEXT NOT NULL DEFAULT 'default',
      source_id TEXT NOT NULL,
      table_id TEXT NOT NULL,
      position_x REAL NOT NULL,
      position_y REAL NOT NULL,
      width REAL DEFAULT 200,
      height REAL DEFAULT 150,
      z_index INTEGER DEFAULT 0,
      color_theme TEXT DEFAULT 'auto',
      is_selected BOOLEAN DEFAULT FALSE,
      is_minimized BOOLEAN DEFAULT FALSE,
      custom_title TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (canvas_id) REFERENCES canvas_state(id) ON DELETE CASCADE,
      FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
    )`);

    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_canvas_table_blocks_canvas ON canvas_table_blocks(canvas_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_canvas_table_blocks_source ON canvas_table_blocks(source_id)`);

    this.db.exec(`CREATE TABLE IF NOT EXISTS canvas_relationships (
      id TEXT PRIMARY KEY,
      canvas_id TEXT NOT NULL DEFAULT 'default',
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      source_table_id TEXT NOT NULL,
      target_table_id TEXT NOT NULL,
      source_column_name TEXT,
      target_column_name TEXT,
      source_handle TEXT,
      target_handle TEXT,
      relationship_type TEXT NOT NULL DEFAULT 'semantic_link',
      confidence_score REAL DEFAULT 1.0,
      visual_style TEXT DEFAULT 'solid',
      line_color TEXT DEFAULT '#22c55e',
      line_width INTEGER DEFAULT 2,
      curve_path TEXT,
      is_selected BOOLEAN DEFAULT FALSE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (canvas_id) REFERENCES canvas_state(id) ON DELETE CASCADE
    )`);

    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_canvas_relationships_canvas ON canvas_relationships(canvas_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_canvas_relationships_source ON canvas_relationships(source_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_canvas_relationships_target ON canvas_relationships(target_id)`);

    this.db.exec(`CREATE TABLE IF NOT EXISTS semantic_relationships (
      id TEXT PRIMARY KEY,
      source_table_id TEXT NOT NULL,
      target_table_id TEXT NOT NULL,
      source_column_name TEXT,
      target_column_name TEXT,
      relationship_type TEXT NOT NULL,
      confidence_score REAL DEFAULT 1.0,
      discovery_method TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_semantic_relationships_source ON semantic_relationships(source_table_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_semantic_relationships_target ON semantic_relationships(target_table_id)`);

    // Insert default canvas state
    this.db.exec(`
      INSERT OR IGNORE INTO canvas_state (id, name, description)
      VALUES ('default', 'Main Canvas', 'The main canvas workspace')
    `);
  }

  /**
   * Perform WAL checkpoint and ensure journal is flushed
   */
  public checkpoint(): void {
    if (this.db) {
      console.log('🔄 CHECKPOINT: Starting checkpoint for database:', this.dbPath);
      
      // Verify data exists BEFORE checkpoint
      try {
        const blockCount = this.db.prepare('SELECT COUNT(*) as count FROM canvas_source_blocks').get() as { count: number };
        const relCount = this.db.prepare('SELECT COUNT(*) as count FROM canvas_relationships').get() as { count: number };
        console.log('🔄 CHECKPOINT: Data BEFORE checkpoint - blocks:', blockCount.count, 'relationships:', relCount.count);
      } catch (error) {
        console.error('Failed to count data before checkpoint:', error);
      }
      
      // In DELETE mode, this is a no-op, but we'll force any pending writes to disk
      try {
        this.db.pragma('wal_checkpoint(FULL)');
      } catch (error) {
        // WAL checkpoint may fail in DELETE mode, that's OK
      }
      
      // Force a VACUUM or simple query to ensure journal is processed
      try {
        this.db.prepare('SELECT 1').get();
      } catch (error) {
        console.error('Failed to execute checkpoint query:', error);
      }
      
      console.log('✅ CHECKPOINT: Checkpoint completed for:', this.dbPath);
    }
  }

  /**
   * Close the database connection
   */
  public close(): void {
    if (this.db) {
      console.log('🔄 CLOSE: Closing database:', this.dbPath);
      
      // Verify data exists BEFORE close
      try {
        const blockCount = this.db.prepare('SELECT COUNT(*) as count FROM canvas_source_blocks').get() as { count: number };
        const relCount = this.db.prepare('SELECT COUNT(*) as count FROM canvas_relationships').get() as { count: number };
        console.log('🔄 CLOSE: Data BEFORE close - blocks:', blockCount.count, 'relationships:', relCount.count);
      } catch (error) {
        console.error('Failed to count data before close:', error);
      }
      
      this.db.close();
      this.db = null;
      this.isInitialized = false;
      console.log('✅ Database closed successfully');
    }
  }

  /**
   * Reset the singleton instance (for testing)
   */
  public static reset(): void {
    if (DatabaseService.instance) {
      DatabaseService.instance.close();
      DatabaseService.instance = null;
    }
  }
}

