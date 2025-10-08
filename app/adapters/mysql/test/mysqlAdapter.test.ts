import { describe, expect, it } from 'vitest';

import { MysqlAdapter, MysqlConnectionSchema } from '../src/mysqlAdapter';

describe('MysqlAdapter', () => {
  it('validates connection configuration', () => {
    expect(() =>
      MysqlConnectionSchema.parse({
        host: 'localhost',
        port: 3306,
        database: 'test',
        user: 'readonly',
        password: '',
      }),
    ).toThrow();
  });

  it('rejects non-read-only queries', async () => {
    const adapter = new MysqlAdapter({
      connection: {
        host: 'example.com',
        port: 3306,
        database: 'db',
        user: 'user',
        password: 'secret',
      },
      poolFactory: () =>
        ({
          getConnection: async () => {
            throw new Error('should not connect for read-only validation');
          },
        } as unknown as import('mysql2/promise').Pool),
    });

    await expect(adapter.query('DELETE FROM accounts')).rejects.toThrow(/read-only/i);
  });
});


