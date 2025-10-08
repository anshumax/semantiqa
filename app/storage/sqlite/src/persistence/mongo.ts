import type { Database } from 'better-sqlite3';

export interface MongoField {
  path: string;
  types: string[];
  nullable: boolean;
}

export interface MongoCollection {
  name: string;
  documentSampleSize: number;
  fields: MongoField[];
}

export interface MongoSchemaSnapshot {
  collections: MongoCollection[];
}

export function persistMongoSnapshot(db: Database, snapshot: MongoSchemaSnapshot) {
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
    for (const collection of snapshot.collections) {
      const collectionId = `mongo.${collection.name}`;
      insertNode.run({
        id: collectionId,
        type: 'collection',
        props: JSON.stringify({
          name: collection.name,
          documentSampleSize: collection.documentSampleSize,
          source: 'mongo',
        }),
      });

      for (const field of collection.fields) {
        const fieldId = `${collectionId}.${field.path}`;
        insertNode.run({
          id: fieldId,
          type: 'field',
          props: JSON.stringify({
            collectionId,
            path: field.path,
            types: field.types,
            nullable: field.nullable,
          }),
        });

        insertEdge.run({
          id: `${fieldId}->${collectionId}`,
          src_id: fieldId,
          dst_id: collectionId,
          type: 'BELONGS_TO',
          props: JSON.stringify({}),
        });
      }
    }
  });

  transaction();
}


