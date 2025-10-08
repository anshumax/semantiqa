import type { Database } from 'better-sqlite3';

import type { DuckDbSchemaSnapshot } from '@semantiqa/adapter-duckdb';

export function persistDuckDbSnapshot(db: Database, snapshot: DuckDbSchemaSnapshot) {
  const insertNode = db.prepare(
    `INSERT INTO nodes (id, type, props, created_at, updated_at)
     VALUES (@id, @type, json(@props), DATETIME('now'), DATETIME('now'))
     ON CONFLICT(id) DO UPDATE SET props = json(@props), updated_at = DATETIME('now')`,
  );

  const insertEdge = db.prepare(
    `INSERT INTO edges (id, src_id, dst_id, type, props, created_at, updated_at)
     VALUES (@id, @src_id, @dst_id, @type, json(@props), DATETIME('now'), DATETIME('now'))
     ON CONFLICT(id) DO UPDATE SET props = json(@props), updated_at = DATETIME('now')`,
  );

  const transaction = db.transaction(() => {
    for (const table of snapshot.tables) {
      const tableId = `duckdb.${table.name}`;
      insertNode.run({
        id: tableId,
        type: 'table',
        props: JSON.stringify({
          name: table.name,
          type: table.type,
          source: 'duckdb',
        }),
      });

      for (const column of table.columns) {
        const columnId = `${tableId}.${column.name}`;
        insertNode.run({
          id: columnId,
          type: 'column',
          props: JSON.stringify({
            tableId,
            name: column.name,
            type: column.type,
            nullable: column.nullable,
          }),
        });

        insertEdge.run({
          id: `${columnId}->${tableId}`,
          src_id: columnId,
          dst_id: tableId,
          type: 'BELONGS_TO',
          props: JSON.stringify({}),
        });
      }
    }
  });

  transaction();
}


