import { describe, expect, it } from 'vitest';

import { PostgresAdapter, PostgresConnectionSchema } from '../src/postgresAdapter';

describe('PostgresAdapter', () => {
  it('validates connection configuration', () => {
    expect(() =>
      PostgresConnectionSchema.parse({
        host: 'localhost',
        port: 5432,
        database: 'test',
        user: 'readonly',
        password: '',
      }),
    ).toThrow();
  });

  it('rejects non-read-only queries', async () => {
    const adapter = new PostgresAdapter({
      connection: {
        host: 'example.com',
        port: 5432,
        database: 'db',
        user: 'user',
        password: 'secret',
      },
      poolFactory: () =>
        ({
          connect: () => {
            throw new Error('should not connect for read-only validation');
          },
        } as unknown as import('pg').Pool),
    });

    await expect(adapter.query('DELETE FROM accounts')).rejects.toThrow(/read-only/i);
  });
});

