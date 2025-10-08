import { describe, expect, it, vi } from 'vitest';

const duckdbMocks = vi.hoisted(() => {
  const allMock = vi.fn().mockResolvedValue([{ ok: 1 }]);
  const closeConnectionMock = vi.fn().mockResolvedValue(undefined);
  const connectReturn = { all: allMock, close: closeConnectionMock };
  const connectMock = vi.fn().mockReturnValue(connectReturn);
  const closeDbMock = vi.fn().mockResolvedValue(undefined);

  return {
    allMock,
    closeConnectionMock,
    connectMock,
    closeDbMock,
  };
});

vi.mock('duckdb', () => ({
  default: class {
    connect() {
      return duckdbMocks.connectMock();
    }

    async close() {
      await duckdbMocks.closeDbMock();
    }
  },
  Database: class {
    connect() {
      return duckdbMocks.connectMock();
    }

    async close() {
      await duckdbMocks.closeDbMock();
    }
  },
}));

import { DuckDbAdapter, DuckDbConnectionSchema } from '../src/duckdbAdapter';

function createMockOptions() {
  return {
    options: {
      connection: {
        filePath: 'file.db',
        readOnly: true,
      },
    },
    connect: duckdbMocks.connectMock,
    all: duckdbMocks.allMock,
    closeConnection: duckdbMocks.closeConnectionMock,
    closeDb: duckdbMocks.closeDbMock,
  } as const;
}

describe('DuckDbAdapter', () => {
  it('validates connection configuration', () => {
    expect(() =>
      DuckDbConnectionSchema.parse({
        filePath: '',
        readOnly: true,
      }),
    ).toThrow();
  });

  it('performs health check using provided factory', async () => {
    const { options, connect, all, closeConnection, closeDb } = createMockOptions();

    const adapter = new DuckDbAdapter(options);

    const healthy = await adapter.healthCheck();

    expect(healthy).toBe(true);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(all).toHaveBeenCalledWith('SELECT 1 AS ok');
    await adapter.close();
    expect(closeConnection).toHaveBeenCalledTimes(1);
    expect(closeDb).toHaveBeenCalledTimes(1);
  });
});


