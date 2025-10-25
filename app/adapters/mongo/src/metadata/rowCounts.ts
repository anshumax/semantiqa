import type { MongoAdapter } from '../mongoAdapter';
import { CrawlWarning } from './types';

export async function getDocumentCounts(
  adapter: MongoAdapter,
  collections: string[]
): Promise<{ documentCounts: Map<string, number | null>; warnings: CrawlWarning[] }> {
  const documentCounts = new Map<string, number | null>();
  const warnings: CrawlWarning[] = [];
  
  for (const collectionName of collections) {
    try {
      // Use countDocuments instead of estimatedDocumentCount for more accuracy
      // We can access the internal client through the adapter's methods
      const result = await adapter.aggregate<{ count: number }>(collectionName, [
        { $count: 'count' }
      ]);
      const count = result[0]?.count ?? 0;
      documentCounts.set(collectionName, count);
    } catch (error) {
      warnings.push({
        level: 'warning',
        feature: 'document_counts',
        message: `Cannot count documents in ${collectionName}: ${(error as Error).message}`,
        suggestion: 'Grant read permissions on this collection.'
      });
      documentCounts.set(collectionName, null);
    }
  }
  
  return { documentCounts, warnings };
}

