import type { MongoAdapter } from '../mongoAdapter';
import { CrawlWarning, AvailableFeatures, EnhancedCrawlResult } from './types';

export interface MongoSchemaField {
  path: string;
  types: string[];
  nullable: boolean;
}

export interface MongoCollectionSchema {
  name: string;
  documentSampleSize: number;
  fields: MongoSchemaField[];
}

export interface MongoSchemaSnapshot {
  collections: MongoCollectionSchema[];
}

export interface MongoCrawlerOptions {
  sampleSize?: number;
}

const DEFAULT_SAMPLE_SIZE = 200;

type JsonValue = unknown;

interface FieldAccumulator {
  types: Set<string>;
  observed: number;
  nullable: boolean;
}

function mergeField(accumulators: Map<string, FieldAccumulator>, path: string, value: JsonValue) {
  const entry = accumulators.get(path) ?? { types: new Set<string>(), observed: 0, nullable: false };

  entry.observed += 1;

  const valueType = determineType(value);
  entry.types.add(valueType);

  if (value === null || value === undefined) {
    entry.nullable = true;
  }

  accumulators.set(path, entry);

  if (valueType === 'object' && value && typeof value === 'object' && !Array.isArray(value)) {
    const nested = value as Record<string, JsonValue>;
    for (const [key, nestedValue] of Object.entries(nested)) {
      mergeField(accumulators, `${path}.${key}`, nestedValue);
    }
  } else if (valueType === 'array' && Array.isArray(value)) {
    entry.types.add('array');
    for (const element of value) {
      mergeField(accumulators, `${path}[]`, element);
    }
  }
}

function determineType(value: JsonValue): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  const type = typeof value;
  if (type === 'object') {
    if (value instanceof Date) {
      return 'date';
    }
    return 'object';
  }
  return type;
}

function processDocument(accumulators: Map<string, FieldAccumulator>, document: Record<string, JsonValue>) {
  for (const [key, value] of Object.entries(document)) {
    mergeField(accumulators, key, value);
  }
}

export async function crawlMongoSchema(
  adapter: MongoAdapter,
  options: MongoCrawlerOptions = {},
): Promise<EnhancedCrawlResult<MongoSchemaSnapshot>> {
  const warnings: CrawlWarning[] = [];
  const sampleSize = options.sampleSize ?? DEFAULT_SAMPLE_SIZE;
  const collections = await adapter.listCollections();
  const results: MongoCollectionSchema[] = [];

  for (const collectionName of collections) {
    try {
      const documents = await adapter.aggregate<Record<string, JsonValue>>(collectionName, [
        { $sample: { size: sampleSize } },
      ]);

      const accumulators = new Map<string, FieldAccumulator>();
      for (const document of documents) {
        processDocument(accumulators, document);
      }

      const fields: MongoSchemaField[] = Array.from(accumulators.entries()).map(([path, data]) => ({
        path,
        types: Array.from(data.types).sort(),
        nullable: data.nullable || data.observed < documents.length,
      }));

      fields.sort((a, b) => a.path.localeCompare(b.path));

      results.push({
        name: collectionName,
        documentSampleSize: documents.length,
        fields,
      });
    } catch (error) {
      warnings.push({
        level: 'warning',
        feature: 'collection_sampling',
        message: `Cannot sample collection ${collectionName}: ${(error as Error).message}`,
        suggestion: 'Grant read permissions on this collection.'
      });
      
      results.push({
        name: collectionName,
        documentSampleSize: 0,
        fields: [],
      });
    }
  }

  return {
    data: { collections: results },
    warnings,
    availableFeatures: {
      hasRowCounts: false,
      hasStatistics: warnings.length === 0,
      hasComments: false,
      hasPermissionErrors: warnings.length > 0,
    },
  };
}


