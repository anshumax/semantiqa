import type { MongoAdapter } from '../mongoAdapter';
import { CrawlWarning, AvailableFeatures, EnhancedCrawlResult } from './types';

export interface MongoFieldProfile {
  path: string;
  nullFraction: number | null;
  distinctCount: number | null;
  sampleCount: number;
}

export interface MongoCollectionProfile {
  name: string;
  fields: MongoFieldProfile[];
  sampledDocuments: number;
}

export interface MongoProfileOptions {
  sampleSize?: number;
}

const DEFAULT_SAMPLE_SIZE = 500;

export async function profileMongoCollections(
  adapter: MongoAdapter,
  options: MongoProfileOptions = {},
): Promise<EnhancedCrawlResult<MongoCollectionProfile[]>> {
  const warnings: CrawlWarning[] = [];
  const sampleSize = options.sampleSize ?? DEFAULT_SAMPLE_SIZE;
  const collections = await adapter.listCollections();
  const profiles: MongoCollectionProfile[] = [];

  for (const collectionName of collections) {
    try {
      const pipeline = [
        { $sample: { size: sampleSize } },
        {
          $project: {
            _id: 0,
            document: '$$ROOT',
          },
        },
      ];

      const documents = await adapter.aggregate<{ document: Record<string, unknown> }>(
        collectionName,
        pipeline,
      );

      const fieldStats = new Map<string, { nulls: number; distinct: Set<string>; count: number }>();

      for (const { document } of documents) {
        collectStats(fieldStats, document);
      }

      const sampledDocuments = documents.length;
      const fields: MongoFieldProfile[] = Array.from(fieldStats.entries()).map(([path, stats]) => ({
        path,
        nullFraction: sampledDocuments > 0 ? stats.nulls / sampledDocuments : null,
        distinctCount: stats.distinct.size,
        sampleCount: stats.count,
      }));

      fields.sort((a, b) => a.path.localeCompare(b.path));

      profiles.push({
        name: collectionName,
        fields,
        sampledDocuments,
      });
    } catch (error) {
      warnings.push({
        level: 'warning',
        feature: 'collection_profiling',
        message: `Cannot profile collection ${collectionName}: ${(error as Error).message}`,
        suggestion: 'Grant read permissions on this collection.'
      });
      
      profiles.push({
        name: collectionName,
        fields: [],
        sampledDocuments: 0,
      });
    }
  }

  return {
    data: profiles,
    warnings,
    availableFeatures: {
      hasRowCounts: false,
      hasStatistics: warnings.length === 0,
      hasComments: false,
      hasPermissionErrors: warnings.length > 0,
    },
  };
}

function collectStats(
  fieldStats: Map<string, { nulls: number; distinct: Set<string>; count: number }>,
  document: Record<string, unknown>,
  parentPath?: string,
) {
  for (const [key, value] of Object.entries(document)) {
    const path = parentPath ? `${parentPath}.${key}` : key;
    const entry = fieldStats.get(path) ?? { nulls: 0, distinct: new Set<string>(), count: 0 };
    entry.count += 1;
    if (value === null || value === undefined) {
      entry.nulls += 1;
    } else {
      entry.distinct.add(JSON.stringify(value));
    }
    fieldStats.set(path, entry);

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      collectStats(fieldStats, value as Record<string, unknown>, path);
    }

    if (Array.isArray(value)) {
      const arrayPath = `${path}[]`;
      const arrayEntry = fieldStats.get(arrayPath) ?? {
        nulls: 0,
        distinct: new Set<string>(),
        count: 0,
      };
      arrayEntry.count += value.length;
      for (const element of value) {
        if (element === null || element === undefined) {
          arrayEntry.nulls += 1;
        } else {
          arrayEntry.distinct.add(JSON.stringify(element));
        }
        if (element && typeof element === 'object' && !Array.isArray(element)) {
          collectStats(fieldStats, element as Record<string, unknown>, arrayPath);
        }
      }
      fieldStats.set(arrayPath, arrayEntry);
    }
  }
}


