import { describe, expect, it, vi } from 'vitest';

import type { MongoAdapter } from '../../src/mongoAdapter';
import { profileMongoCollections } from '../../src/metadata/profiler';

describe('profileMongoCollections', () => {
  it('profiles field null fractions and distinct counts', async () => {
    const listCollections = vi.fn().mockResolvedValue(['accounts']);
    const aggregate = vi.fn().mockResolvedValue([
      { document: { name: 'Alice', tags: ['vip'] } },
      { document: { name: 'Bob', tags: ['vip', 'new'] } },
      { document: { name: 'Charlie', tags: null } },
    ]);

    const adapter = {
      listCollections,
      aggregate,
    } as unknown as MongoAdapter;

    const profiles = await profileMongoCollections(adapter, { sampleSize: 50 });

    expect(profiles).toHaveLength(1);
    const profile = profiles[0];
    expect(profile.name).toBe('accounts');
    expect(profile.sampledDocuments).toBe(3);

    const nameField = profile.fields.find((field) => field.path === 'name');
    expect(nameField?.nullFraction).toBe(0);
    expect(nameField?.distinctCount).toBe(3);

    const tagsField = profile.fields.find((field) => field.path === 'tags');
    expect(tagsField?.nullFraction).toBeCloseTo(1 / 3);
  });
});


