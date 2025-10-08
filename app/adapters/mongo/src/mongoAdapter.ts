import { MongoClient, type Document, type MongoClientOptions } from 'mongodb';

import { z } from 'zod';

export const MongoConnectionSchema = z.object({
  uri: z.string().nonempty(),
  database: z.string().nonempty(),
  replicaSet: z.string().optional(),
  connectTimeoutMs: z.number().int().positive().optional(),
});

export type MongoConnectionConfig = z.infer<typeof MongoConnectionSchema>;

export interface MongoAdapterOptions {
  connection: MongoConnectionConfig;
  clientFactory?: (uri: string, options?: MongoClientOptions) => MongoClient;
}

export class MongoAdapter {
  private readonly config: MongoConnectionConfig;
  private client?: MongoClient;
  private readonly factory: (uri: string, options?: MongoClientOptions) => MongoClient;

  constructor(options: MongoAdapterOptions) {
    this.config = MongoConnectionSchema.parse(options.connection);
    this.factory = options.clientFactory ?? ((uri, opts) => new MongoClient(uri, opts));
  }

  private async getClient(): Promise<MongoClient> {
    if (!this.client) {
      const { uri, connectTimeoutMs, replicaSet } = this.config;
      const client = this.factory(uri, {
        connectTimeoutMS: connectTimeoutMs ?? 5_000,
        replicaSet,
        readPreference: 'primaryPreferred',
        serverSelectionTimeoutMS: connectTimeoutMs ?? 5_000,
      });
      await client.connect();
      this.client = client;
    }
    return this.client;
  }

  async healthCheck(): Promise<boolean> {
    const client = await this.getClient();
    const adminDb = client.db(this.config.database).admin();
    const result = await adminDb.ping();
    return result.ok === 1;
  }

  async listCollections(): Promise<string[]> {
    const client = await this.getClient();
    const collections = await client.db(this.config.database).listCollections().toArray();
    return collections.map((collection) => collection.name);
  }

  async aggregate<T extends Document = Document>(
    collection: string,
    pipeline: Document[],
  ): Promise<T[]> {
    const client = await this.getClient();
    const cursor = client.db(this.config.database).collection(collection).aggregate<T>(pipeline, {
      allowDiskUse: false,
      maxTimeMS: 5_000,
    });
    return cursor.toArray();
  }

  async close() {
    if (this.client) {
      await this.client.close();
      this.client = undefined;
    }
  }
}


