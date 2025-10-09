import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SourcesAddRequest } from '@semantiqa/contracts';
import { SourceRepository } from '../src/repository/SourceRepository';

describe('SourceRepository', () => {
  const runMock = vi.fn();
  const prepareMock = vi.fn(() => ({ run: runMock }));
  const transactionMock = vi.fn((callback: () => void) => {
    return () => {
      callback();
    };
  });

  const db = {
    prepare: prepareMock,
    transaction: transactionMock,
  } as unknown as Parameters<typeof SourceRepository>[0];

  const baseRequest: SourcesAddRequest = {
    kind: 'postgres',
    name: 'orders',
    owners: ['data@acme.test'],
    tags: ['prod'],
    description: 'Orders database',
    connection: {
      host: 'localhost',
      port: 5432,
      database: 'orders',
      user: 'readonly',
      password: 'secret',
      ssl: true,
    },
  };

  let repository: SourceRepository;

  beforeEach(() => {
    runMock.mockReset();
    prepareMock.mockClear();
    transactionMock.mockClear();
    repository = new SourceRepository(db as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('persists initial crawl and connection statuses when adding a source', () => {
    repository.addSource(baseRequest, 'src_postgres_fake', 'not_crawled', 'checking');

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(prepareMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sources (id, name, kind, config, owners, tags, status, connection_status)'),
    );

    const insertArgs = runMock.mock.calls[0][0];
    expect(insertArgs).toMatchObject({
      id: 'src_postgres_fake',
      status: 'not_crawled',
      connection_status: 'checking',
    });
  });

  it('updates crawl status with timestamp and optional error payload', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-01T10:00:00Z'));

    repository.updateCrawlStatus('src123', 'error', { message: 'timeout', meta: { elapsedMs: 1200 } });

    expect(prepareMock).toHaveBeenCalledWith(expect.stringContaining('UPDATE sources')); // called by updateCrawlStatus
    const updateArgs = runMock.mock.calls.at(-1)?.[0];
    expect(updateArgs).toMatchObject({
      id: 'src123',
      status: 'error',
      status_updated_at: '2024-05-01T10:00:00.000Z',
      last_error: 'timeout',
    });
    expect(updateArgs.last_error_meta).toBe(JSON.stringify({ elapsedMs: 1200 }));
  });

  it('updates connection status and clears error metadata when healthy', () => {
    repository.updateConnectionStatus('src123', 'connected', 'previous error');

    const updateArgs = runMock.mock.calls.at(-1)?.[0];
    expect(updateArgs).toMatchObject({
      id: 'src123',
      connection_status: 'connected',
      last_connection_error: null,
    });
  });

  it('stores connection errors when status becomes error', () => {
    repository.updateConnectionStatus('src123', 'error', 'network unreachable');

    const updateArgs = runMock.mock.calls.at(-1)?.[0];
    expect(updateArgs).toMatchObject({
      id: 'src123',
      connection_status: 'error',
      last_connection_error: 'network unreachable',
    });
  });
});


