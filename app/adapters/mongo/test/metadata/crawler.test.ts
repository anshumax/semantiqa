import { describe, expect, it, vi } from 'vitest';

import type { MongoAdapter } from '../../src/mongoAdapter';
import { crawlMongoSchema } from '../../src/metadata/crawler';

describe('crawlMongoSchema', () => {
  it('builds schema snapshot from sampled documents', async () => {
    const listCollections = vi.fn().mockResolvedValue(['accounts']);
    const aggregate = vi
      .fn()
      .mockResolvedValue([
        { id: 1, name: 'Alice', preferences: { theme: 'light', tags: ['vip'] } },
        { id: 2, name: 'Bob', preferences: { theme: 'dark', tags: [] } },
      ]);

    const adapter = {
      listCollections,
      aggregate,
    } as unknown as MongoAdapter;

    const snapshot = await crawlMongoSchema(adapter, { sampleSize: 10 });

    expect(snapshot.collections).toHaveLength(1);
    const collection = snapshot.collections[0];
    expect(collection.name).toBe('accounts');
    expect(collection.documentSampleSize).toBe(2);

    const fieldPaths = collection.fields.map((field) => field.path);
    expect(fieldPaths).toEqual([
      'id',
      'name',
      'preferences',
      'preferences.tags',
      'preferences.tags[]',
      'preferences.theme',
    ]);
  });
});


