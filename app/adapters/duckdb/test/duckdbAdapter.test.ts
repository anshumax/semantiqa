import { afterEach, describe, expect, it, vi } from 'vitest';

const duckdbMocks = vi.hoisted(() => {
  const allCallback = vi.fn((sql: string, callback: (error: unknown, rows: unknown[]) => void) => {
    callback(null, [{ ok: 1 }]);
  });
  const allPromise = vi.fn().mockResolvedValue([{ ok: 1 }]);
  const closeConnectionMock = vi.fn().mockResolvedValue(undefined);
  const connectReturn = {
    all: vi.fn((sql: string, ...args: unknown[]) => {
      const maybeCallback = args.at(-1);
      if (typeof maybeCallback === 'function') {
        allCallback(sql, maybeCallback as (error: unknown, rows: unknown[]) => void);
        return;
      }
      return allPromise(sql);
    }),
    close: closeConnectionMock,
  };
  const connectMock = vi.fn().mockReturnValue(connectReturn);
  const closeDbMock = vi.fn().mockResolvedValue(undefined);

  return {
    allCallback,
    allPromise,
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
  OPEN_READONLY: 1,
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
    all: duckdbMocks.connectMock.mock.results[0]?.value.all ?? duckdbMocks.connectMock,
    closeConnection: duckdbMocks.closeConnectionMock,
    closeDb: duckdbMocks.closeDbMock,
  } as const;
}

describe('DuckDbAdapter', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

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
    expect(duckdbMocks.allCallback).toHaveBeenCalledWith('SELECT 1 AS ok', expect.any(Function));
    await adapter.close();
    expect(closeConnection).toHaveBeenCalledTimes(1);
    expect(closeDb).toHaveBeenCalledTimes(1);
  });
});


