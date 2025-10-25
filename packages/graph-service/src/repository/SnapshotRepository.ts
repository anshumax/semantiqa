import type { Database } from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

interface RelationalSnapshot {
  tables: Array<{
    schema: string;
    name: string;
    type: string;
    comment: string | null;
    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
      defaultValue: string | null;
      comment: string | null;
    }>;
  }>;
}

interface MongoSnapshot {
  collections: Array<{
    database: string;
    name: string;
    fields: Array<{
      path: string;
      types: string[];
      isArray: boolean;
    }>;
  }>;
}

type SnapshotData = RelationalSnapshot | MongoSnapshot;

export class SnapshotRepository {
  constructor(private readonly db: Database) {}

  persistSnapshot(params: { 
    sourceId: string; 
    kind: string; 
    snapshot: SnapshotData; 
    stats?: unknown;
    warnings?: Array<{ level: string; feature: string; message: string; suggestion?: string }>;
  }): void {
    // Log warnings if present
    if (params.warnings && params.warnings.length > 0) {
      const warningsSummary = {
        count: params.warnings.length,
        criticalCount: params.warnings.filter(w => w.level === 'error').length,
        features: [...new Set(params.warnings.map(w => w.feature))],
      };
      console.log(`[SnapshotRepository] Stored snapshot with warnings for ${params.sourceId}:`, warningsSummary);
    }

    const transaction = this.db.transaction(() => {
      if (params.kind === 'mongo') {
        this.persistMongoSnapshot(params.sourceId, params.snapshot as MongoSnapshot, params.stats);
      } else {
        this.persistRelationalSnapshot(params.sourceId, params.snapshot as RelationalSnapshot, params.stats);
      }
    });

    transaction();
  }

  private persistRelationalSnapshot(sourceId: string, snapshot: RelationalSnapshot, stats?: unknown): void {
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
       VALUES (@id, @type, json(@props), @owner_ids, @tags, @sensitivity, @status, @origin_device_id)`,
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
      `UPDATE nodes SET type = @type, props = json(@props), owner_ids = @owner_ids, tags = @tags, 
       sensitivity = @sensitivity, status = @status, origin_device_id = @origin_device_id
       WHERE id = @id`,
    );

    const checkEdge = this.db.prepare<{ id: string }>(`SELECT id FROM edges WHERE id = @id`);
    const insertEdge = this.db.prepare<{
      id: string;
      src_id: string;
      dst_id: string;
      type: string;
      props: string | null;
      origin_device_id: string | null;
    }>(
      `INSERT INTO edges (id, src_id, dst_id, type, props, origin_device_id)
       VALUES (@id, @src_id, @dst_id, @type, @props, @origin_device_id)`,
    );
    const updateEdge = this.db.prepare<{
      id: string;
      src_id: string;
      dst_id: string;
      type: string;
      props: string | null;
      origin_device_id: string | null;
    }>(
      `UPDATE edges SET src_id = @src_id, dst_id = @dst_id, type = @type, props = @props, 
       origin_device_id = @origin_device_id
       WHERE id = @id`,
    );

    const upsertNode = (params: {
      id: string;
      type: string;
      props: string;
      owner_ids: string | null;
      tags: string | null;
      sensitivity: string | null;
      status: string | null;
      origin_device_id: string | null;
    }) => {
      const exists = checkNode.get({ id: params.id });
      if (exists) {
        updateNode.run(params);
      } else {
        insertNode.run(params);
      }
    };

    const upsertEdge = (params: {
      id: string;
      src_id: string;
      dst_id: string;
      type: string;
      props: string | null;
      origin_device_id: string | null;
    }) => {
      const exists = checkEdge.get({ id: params.id });
      if (exists) {
        updateEdge.run(params);
      } else {
        insertEdge.run(params);
      }
    };

    for (const table of snapshot.tables) {
      const tableId = `tbl_${sourceId}_${table.schema}_${table.name}`;

      // Upsert table node
      upsertNode({
        id: tableId,
        type: 'table',
        props: JSON.stringify({
          sourceId,
          schema: table.schema,
          name: table.name,
          tableType: table.type,
          comment: table.comment,
        }),
        owner_ids: null,
        tags: null,
        sensitivity: null,
        status: 'active',
        origin_device_id: null,
      });

      // Upsert edge from source to table
      const sourceEdgeId = `edge_${sourceId}_${tableId}`;
      upsertEdge({
        id: sourceEdgeId,
        src_id: sourceId,
        dst_id: tableId,
        type: 'CONTAINS',
        props: null,
        origin_device_id: null,
      });

      // Upsert column nodes and edges
      for (const column of table.columns) {
        const columnId = `col_${tableId}_${column.name}`;

        upsertNode({
          id: columnId,
          type: 'column',
          props: JSON.stringify({
            sourceId,
            tableName: `${table.schema}.${table.name}`,
            name: column.name,
            dataType: column.type,
            nullable: column.nullable,
            defaultValue: column.defaultValue,
            comment: column.comment,
          }),
          owner_ids: null,
          tags: null,
          sensitivity: null,
          status: 'active',
          origin_device_id: null,
        });

        const columnEdgeId = `edge_${tableId}_${columnId}`;
        upsertEdge({
          id: columnEdgeId,
          src_id: tableId,
          dst_id: columnId,
          type: 'HAS_COLUMN',
          props: null,
          origin_device_id: null,
        });
      }
    }

    // Store stats as provenance if provided
    if (stats) {
      const insertProvenance = this.db.prepare<{
        id: string;
        owner_type: string;
        owner_id: string;
        kind: string;
        ref: string | null;
        meta: string;
      }>(
        `INSERT INTO provenance (id, owner_type, owner_id, kind, ref, meta)
         VALUES (@id, @owner_type, @owner_id, @kind, @ref, json(@meta))`,
      );

      insertProvenance.run({
        id: `prov_${sourceId}_${randomUUID()}`,
        owner_type: 'source',
        owner_id: sourceId,
        kind: 'profile_stats',
        ref: null,
        meta: JSON.stringify(stats),
      });
    }
  }

  private persistMongoSnapshot(sourceId: string, snapshot: MongoSnapshot, stats?: unknown): void {
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
       VALUES (@id, @type, json(@props), @owner_ids, @tags, @sensitivity, @status, @origin_device_id)`,
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
      `UPDATE nodes SET type = @type, props = json(@props), owner_ids = @owner_ids, tags = @tags, 
       sensitivity = @sensitivity, status = @status, origin_device_id = @origin_device_id
       WHERE id = @id`,
    );

    const checkEdge = this.db.prepare<{ id: string }>(`SELECT id FROM edges WHERE id = @id`);
    const insertEdge = this.db.prepare<{
      id: string;
      src_id: string;
      dst_id: string;
      type: string;
      props: string | null;
      origin_device_id: string | null;
    }>(
      `INSERT INTO edges (id, src_id, dst_id, type, props, origin_device_id)
       VALUES (@id, @src_id, @dst_id, @type, @props, @origin_device_id)`,
    );
    const updateEdge = this.db.prepare<{
      id: string;
      src_id: string;
      dst_id: string;
      type: string;
      props: string | null;
      origin_device_id: string | null;
    }>(
      `UPDATE edges SET src_id = @src_id, dst_id = @dst_id, type = @type, props = @props, 
       origin_device_id = @origin_device_id
       WHERE id = @id`,
    );

    const upsertNode = (params: {
      id: string;
      type: string;
      props: string;
      owner_ids: string | null;
      tags: string | null;
      sensitivity: string | null;
      status: string | null;
      origin_device_id: string | null;
    }) => {
      const exists = checkNode.get({ id: params.id });
      if (exists) {
        updateNode.run(params);
      } else {
        insertNode.run(params);
      }
    };

    const upsertEdge = (params: {
      id: string;
      src_id: string;
      dst_id: string;
      type: string;
      props: string | null;
      origin_device_id: string | null;
    }) => {
      const exists = checkEdge.get({ id: params.id });
      if (exists) {
        updateEdge.run(params);
      } else {
        insertEdge.run(params);
      }
    };

    for (const collection of snapshot.collections) {
      const collectionId = `coll_${sourceId}_${collection.database}_${collection.name}`;

      // Upsert collection node
      upsertNode({
        id: collectionId,
        type: 'collection',
        props: JSON.stringify({
          sourceId,
          database: collection.database,
          name: collection.name,
        }),
        owner_ids: null,
        tags: null,
        sensitivity: null,
        status: 'active',
        origin_device_id: null,
      });

      // Upsert edge from source to collection
      const sourceEdgeId = `edge_${sourceId}_${collectionId}`;
      upsertEdge({
        id: sourceEdgeId,
        src_id: sourceId,
        dst_id: collectionId,
        type: 'CONTAINS',
        props: null,
        origin_device_id: null,
      });

      // Upsert field nodes and edges
      for (const field of collection.fields) {
        const fieldId = `fld_${collectionId}_${field.path.replace(/\./g, '_')}`;

        upsertNode({
          id: fieldId,
          type: 'field',
          props: JSON.stringify({
            sourceId,
            collectionName: `${collection.database}.${collection.name}`,
            path: field.path,
            types: field.types,
            isArray: field.isArray,
          }),
          owner_ids: null,
          tags: null,
          sensitivity: null,
          status: 'active',
          origin_device_id: null,
        });

        const fieldEdgeId = `edge_${collectionId}_${fieldId}`;
        upsertEdge({
          id: fieldEdgeId,
          src_id: collectionId,
          dst_id: fieldId,
          type: 'HAS_FIELD',
          props: null,
          origin_device_id: null,
        });
      }
    }

    // Store stats as provenance if provided
    if (stats) {
      const insertProvenance = this.db.prepare<{
        id: string;
        owner_type: string;
        owner_id: string;
        kind: string;
        ref: string | null;
        meta: string;
      }>(
        `INSERT INTO provenance (id, owner_type, owner_id, kind, ref, meta)
         VALUES (@id, @owner_type, @owner_id, @kind, @ref, json(@meta))`,
      );

      insertProvenance.run({
        id: `prov_${sourceId}_${randomUUID()}`,
        owner_type: 'source',
        owner_id: sourceId,
        kind: 'profile_stats',
        ref: null,
        meta: JSON.stringify(stats),
      });
    }
  }
}

