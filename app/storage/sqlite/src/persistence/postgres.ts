import type { Database } from 'better-sqlite3';

export interface PostgresSchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string | null;
  comment?: string | null;
}

export interface PostgresSchemaTable {
  schema: string;
  name: string;
  type: 'BASE TABLE' | 'VIEW';
  comment?: string | null;
  columns: PostgresSchemaColumn[];
}

export interface PostgresSchemaSnapshot {
  tables: PostgresSchemaTable[];
}

export function persistPostgresSnapshot(db: Database, snapshot: PostgresSchemaSnapshot) {
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
      const tableId = `pg.${table.schema}.${table.name}`;
      insertNode.run({
        id: tableId,
        type: 'table',
        props: JSON.stringify({
          schema: table.schema,
          name: table.name,
          comment: table.comment,
          source: 'postgres',
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
            defaultValue: column.defaultValue,
            comment: column.comment,
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

