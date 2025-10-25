import type { Database } from 'better-sqlite3';
import type { SourcesAddRequest } from '@semantiqa/contracts';

type StoredSourceConfig = {
  description?: string;
  connection: Record<string, unknown>;
};

function sanitizeConnectionConfig(request: SourcesAddRequest): StoredSourceConfig {
  const { description } = request;

  switch (request.kind) {
    case 'postgres':
      return {
        description,
        connection: {
          host: request.connection.host,
          port: request.connection.port,
          database: request.connection.database,
          user: request.connection.user,
          ssl: request.connection.ssl ?? false,
        },
      } satisfies StoredSourceConfig;
    case 'mysql':
      return {
        description,
        connection: {
          host: request.connection.host,
          port: request.connection.port,
          database: request.connection.database,
          user: request.connection.user,
          ssl: request.connection.ssl ?? false,
        },
      } satisfies StoredSourceConfig;
    case 'mongo':
      return {
        description,
        connection: {
          database: request.connection.database,
          replicaSet: request.connection.replicaSet ?? null,
          hasCredentials: /@/.test(request.connection.uri),
        },
      } satisfies StoredSourceConfig;
    case 'duckdb':
      return {
        description,
        connection: {
          filePath: request.connection.filePath,
        },
      } satisfies StoredSourceConfig;
    default: {
      const exhaustive: never = request;
      return exhaustive;
    }
  }
}

export class SourceRepository {
  constructor(private readonly db: Database) {}

  /**
   * Check if a source with the same connection already exists
   * Returns the existing source information if found
   */
  findExistingConnection(payload: SourcesAddRequest): { id: string; name: string } | null {
    const config = sanitizeConnectionConfig(payload);
    
    // Build the query based on connection type
    let query = '';
    let params: Record<string, any> = {};
    
    switch (payload.kind) {
      case 'postgres':
      case 'mysql': {
        query = `
          SELECT id, name FROM sources 
          WHERE kind = @kind 
          AND json_extract(config, '$.connection.host') = @host 
          AND json_extract(config, '$.connection.port') = @port
          AND json_extract(config, '$.connection.database') = @database
        `;
        params = {
          kind: payload.kind,
          host: config.connection.host,
          port: config.connection.port,
          database: config.connection.database,
        };
        break;
      }
      case 'mongo': {
        // For MongoDB, we'll check database name since URI might contain credentials
        query = `
          SELECT id, name FROM sources 
          WHERE kind = 'mongo' 
          AND json_extract(config, '$.connection.database') = @database
        `;
        params = {
          database: config.connection.database,
        };
        break;
      }
      case 'duckdb': {
        // For DuckDB, check the file path
        query = `
          SELECT id, name FROM sources 
          WHERE kind = 'duckdb' 
          AND json_extract(config, '$.connection.filePath') = @filePath
        `;
        params = {
          filePath: config.connection.filePath,
        };
        break;
      }
      default: {
        const exhaustive: never = payload;
        return exhaustive;
      }
    }
    
    const stmt = this.db.prepare(query);
    const existing = stmt.get(params) as { id: string; name: string } | undefined;
    
    return existing || null;
  }

  addSource(
    payload: SourcesAddRequest,
    sourceId: string,
    initialCrawlStatus: 'not_crawled' | 'crawling' | 'crawled' | 'error' = 'not_crawled',
    initialConnectionStatus: 'unknown' | 'checking' | 'connected' | 'error' = 'unknown',
  ): { sourceId: string } {
    // Check for existing connection
    const existing = this.findExistingConnection(payload);
    if (existing) {
      throw new Error(
        `A source with the same connection already exists: "${existing.name}" (ID: ${existing.id}). ` +
        'Please use the existing source or remove it first.'
      );
    }

    const config = sanitizeConnectionConfig(payload);
    const owners = payload.owners ?? [];
    const tags = payload.tags ?? [];

    const insertSource = this.db.prepare<{
      id: string;
      name: string;
      kind: string;
      config: string;
      owners: string;
      tags: string;
      status: string;
      connection_status: string;
    }>(
      `INSERT INTO sources (id, name, kind, config, owners, tags, status, connection_status)
       VALUES (@id, @name, @kind, json(@config), json(@owners), json(@tags), @status, @connection_status)`,
    );

    // Check if node already exists for this source
    const checkNode = this.db.prepare<{ id: string }>(`SELECT id FROM nodes WHERE id = @id`);
    const insertNode = this.db.prepare<{
      id: string;
      type: string;
      props: string;
      owner_ids: string | null;
      tags: string | null;
      sensitivity: string | null;
      status: string | null;
      origin_device_id: string | null;
    }>(
      `INSERT INTO nodes (id, type, props, owner_ids, tags, sensitivity, status, origin_device_id)
       VALUES (@id, @type, json(@props), json(@owner_ids), json(@tags), @sensitivity, @status, @origin_device_id)`,
    );
    const updateNode = this.db.prepare<{
      id: string;
      type: string;
      props: string;
      owner_ids: string | null;
      tags: string | null;
      sensitivity: string | null;
      status: string | null;
      origin_device_id: string | null;
    }>(
      `UPDATE nodes SET type = @type, props = json(@props), owner_ids = json(@owner_ids), tags = json(@tags), 
       sensitivity = @sensitivity, status = @status, origin_device_id = @origin_device_id
       WHERE id = @id`,
    );

    const transaction = this.db.transaction(() => {
      // Insert into sources table
      insertSource.run({
        id: sourceId,
        name: payload.name,
        kind: payload.kind,
        config: JSON.stringify(config),
        owners: JSON.stringify(owners),
        tags: JSON.stringify(tags),
        status: initialCrawlStatus,
        connection_status: initialConnectionStatus,
      });

      // Upsert node representation of the source
      const nodeParams = {
        id: sourceId,
        type: 'source',
        props: JSON.stringify({
          name: payload.name,
          kind: payload.kind,
          description: payload.description,
        }),
        owner_ids: owners.length > 0 ? JSON.stringify(owners) : null,
        tags: tags.length > 0 ? JSON.stringify(tags) : null,
        sensitivity: null,
        status: 'active',
        origin_device_id: null,
      };

      const exists = checkNode.get({ id: sourceId });
      if (exists) {
        updateNode.run(nodeParams);
      } else {
        insertNode.run(nodeParams);
      }
    });

    transaction();

    return { sourceId };
  }

  updateCrawlStatus(
    sourceId: string,
    status: 'not_crawled' | 'crawling' | 'crawled' | 'error',
    error?: { message: string; meta?: Record<string, unknown> },
  ) {
    const update = this.db.prepare<{
      status: string;
      status_updated_at: string;
      last_crawl_at?: string | null;
      last_error?: string | null;
      last_error_meta?: string | null;
      id: string;
    }>(
      `UPDATE sources
         SET status = @status,
             status_updated_at = @status_updated_at,
             last_crawl_at = CASE WHEN @status = 'crawled' THEN DATETIME('now') ELSE last_crawl_at END,
             last_error = @last_error,
             last_error_meta = @last_error_meta
       WHERE id = @id`,
    );

    update.run({
      id: sourceId,
      status,
      status_updated_at: new Date().toISOString(),
      last_error: error ? error.message : null,
      last_error_meta: error?.meta ? JSON.stringify(error.meta) : null,
    });
  }

  updateConnectionStatus(
    sourceId: string,
    status: 'unknown' | 'checking' | 'connected' | 'error',
    errorMessage?: string,
  ) {
    const update = this.db.prepare<{
      connection_status: string;
      last_connected_at?: string | null;
      last_connection_error?: string | null;
      id: string;
    }>(
      `UPDATE sources
         SET connection_status = @connection_status,
             last_connected_at = CASE WHEN @connection_status = 'connected' THEN DATETIME('now') ELSE last_connected_at END,
             last_connection_error = @last_connection_error
       WHERE id = @id`,
    );

    update.run({
      id: sourceId,
      connection_status: status,
      last_connection_error: status === 'error' ? errorMessage ?? null : null,
    });
  }

  removeSource(sourceId: string): void {
    const transaction = this.db.transaction(() => {
      this.db.prepare('DELETE FROM sources WHERE id = ?').run(sourceId);
    });

    transaction();
  }

  /**
   * Comprehensive deletion of a data source and all its associated data
   * Includes: canvas blocks, relationships, nodes, edges, embeddings, and audit logs
   */
  deleteSourceCascade(sourceId: string): { deletedCounts: Record<string, number> } {
    const counts: Record<string, number> = {};
    
    const transaction = this.db.transaction(() => {
      // 1. Delete canvas relationships where this source is involved
      const deleteCanvasRelationships = this.db.prepare(`
        DELETE FROM canvas_relationships 
        WHERE source_id = ? OR target_id = ?
      `);
      const relResult = deleteCanvasRelationships.run(sourceId, sourceId);
      counts.canvasRelationships = relResult.changes ?? 0;
      
      // 2. Delete canvas table blocks for this source
      const deleteTableBlocks = this.db.prepare(`
        DELETE FROM canvas_table_blocks WHERE source_id = ?
      `);
      const tableBlockResult = deleteTableBlocks.run(sourceId);
      counts.canvasTableBlocks = tableBlockResult.changes ?? 0;
      
      // 3. Delete canvas source block (will cascade due to FK)
      const deleteSourceBlock = this.db.prepare(`
        DELETE FROM canvas_source_blocks WHERE source_id = ?
      `);
      const sourceBlockResult = deleteSourceBlock.run(sourceId);
      counts.canvasSourceBlocks = sourceBlockResult.changes ?? 0;
      
      // 4. Get all nodes owned by this source (tables, columns, etc.)
      const getOwnedNodes = this.db.prepare(`
        SELECT id FROM nodes 
        WHERE owner_ids IS NOT NULL 
        AND json_extract(owner_ids, '$[0]') = ?
      `);
      const ownedNodes = getOwnedNodes.all(sourceId) as Array<{ id: string }>;
      const ownedNodeIds = ownedNodes.map(n => n.id);
      counts.nodesFound = ownedNodeIds.length;
      
      // 5. Delete embeddings for this source's nodes and the source itself
      if (ownedNodeIds.length > 0) {
        const placeholders = ownedNodeIds.map(() => '?').join(',');
        const deleteEmbeddings = this.db.prepare(`
          DELETE FROM embeddings 
          WHERE owner_id IN (${placeholders})
          OR owner_id = ?
        `);
        const embResult = deleteEmbeddings.run(...ownedNodeIds, sourceId);
        counts.embeddings = embResult.changes ?? 0;
      } else {
        const deleteSourceEmbedding = this.db.prepare(`
          DELETE FROM embeddings WHERE owner_id = ?
        `);
        const embResult = deleteSourceEmbedding.run(sourceId);
        counts.embeddings = embResult.changes ?? 0;
      }
      
      // 6. Delete edges connected to this source's nodes
      if (ownedNodeIds.length > 0) {
        const placeholders = ownedNodeIds.map(() => '?').join(',');
        const deleteEdges = this.db.prepare(`
          DELETE FROM edges 
          WHERE src_id IN (${placeholders})
          OR dst_id IN (${placeholders})
        `);
        const edgeResult = deleteEdges.run(...ownedNodeIds, ...ownedNodeIds);
        counts.edges = edgeResult.changes ?? 0;
      } else {
        counts.edges = 0;
      }
      
      // 7. Delete semantic relationships involving this source's tables
      if (ownedNodeIds.length > 0) {
        const placeholders = ownedNodeIds.map(() => '?').join(',');
        const deleteSemanticRels = this.db.prepare(`
          DELETE FROM semantic_relationships 
          WHERE source_table_id IN (${placeholders})
          OR target_table_id IN (${placeholders})
        `);
        const semRelResult = deleteSemanticRels.run(...ownedNodeIds, ...ownedNodeIds);
        counts.semanticRelationships = semRelResult.changes ?? 0;
      } else {
        counts.semanticRelationships = 0;
      }
      
      // 8. Delete all nodes owned by this source
      if (ownedNodeIds.length > 0) {
        const placeholders = ownedNodeIds.map(() => '?').join(',');
        const deleteNodes = this.db.prepare(`
          DELETE FROM nodes WHERE id IN (${placeholders})
        `);
        const nodeResult = deleteNodes.run(...ownedNodeIds);
        counts.nodes = nodeResult.changes ?? 0;
      } else {
        counts.nodes = 0;
      }
      
      // 9. Delete the source node itself
      const deleteSourceNode = this.db.prepare(`
        DELETE FROM nodes WHERE id = ?
      `);
      const sourceNodeResult = deleteSourceNode.run(sourceId);
      counts.sourceNode = sourceNodeResult.changes ?? 0;
      
      // 10. Delete provenance records
      if (ownedNodeIds.length > 0) {
        const placeholders = ownedNodeIds.map(() => '?').join(',');
        const deleteProvenance = this.db.prepare(`
          DELETE FROM provenance 
          WHERE owner_id IN (${placeholders})
          OR owner_id = ?
        `);
        const provResult = deleteProvenance.run(...ownedNodeIds, sourceId);
        counts.provenance = provResult.changes ?? 0;
      } else {
        const deleteSourceProv = this.db.prepare(`
          DELETE FROM provenance WHERE owner_id = ?
        `);
        const provResult = deleteSourceProv.run(sourceId);
        counts.provenance = provResult.changes ?? 0;
      }
      
      // 11. Delete changelog entries related to this source
      const deleteChangelog = this.db.prepare(`
        DELETE FROM changelog WHERE entity_id = ?
      `);
      const changelogResult = deleteChangelog.run(sourceId);
      counts.changelog = changelogResult.changes ?? 0;
      
      // 12. Finally, delete the source itself from sources table
      const deleteSource = this.db.prepare(`
        DELETE FROM sources WHERE id = ?
      `);
      const sourceResult = deleteSource.run(sourceId);
      counts.source = sourceResult.changes ?? 0;
      
      console.log('🗑️ Source deletion completed:', { sourceId, counts });
    });

    transaction();
    
    return { deletedCounts: counts };
  }
}

