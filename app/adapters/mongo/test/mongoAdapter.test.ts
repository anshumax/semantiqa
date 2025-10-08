import { describe, expect, it, vi } from 'vitest';

import { MongoAdapter, MongoConnectionSchema } from '../src/mongoAdapter';

describe('MongoAdapter', () => {
  it('validates connection configuration', () => {
    expect(() =>
      MongoConnectionSchema.parse({
        uri: '',
        database: 'analytics',
      }),
    ).toThrow();
  });

  it('initializes client with provided factory', async () => {
    const connect = vi.fn();
    const ping = vi.fn().mockResolvedValue({ ok: 1 });
    const admin = vi.fn().mockReturnValue({ ping });
    const db = vi.fn().mockReturnValue({ admin });
    const close = vi.fn();

    const mockClient = {
      connect,
      db,
      close,
    } as unknown as import('mongodb').MongoClient;

    const adapter = new MongoAdapter({
      connection: {
        uri: 'mongodb://localhost:27017',
        database: 'analytics',
      },
      clientFactory: () => mockClient,
    });

    const healthy = await adapter.healthCheck();

    expect(healthy).toBe(true);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(db).toHaveBeenCalledWith('analytics');
    await adapter.close();
    expect(close).toHaveBeenCalledTimes(1);
  });
});


