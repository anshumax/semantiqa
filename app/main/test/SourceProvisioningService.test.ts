import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SourcesAddRequest } from '@semantiqa/contracts';
import { SourceProvisioningService } from '../src/application/SourceProvisioningService';

const addSourceMock = vi.fn<
  Promise<{ sourceId: string }> ,
  [SourcesAddRequest, 'not_crawled' | 'crawling' | 'crawled' | 'error', 'unknown' | 'checking' | 'connected' | 'error']
>();
const setCrawlStatusMock = vi.fn<void, [string, 'not_crawled' | 'crawling' | 'crawled' | 'error', { message: string; meta?: Record<string, unknown> } | undefined]>();
const setConnectionStatusMock = vi.fn<void, [string, 'unknown' | 'checking' | 'connected' | 'error', string | undefined]>();
const removeSourceMock = vi.fn<void, [string]>();

vi.mock('@semantiqa/graph-service', () => {
  class MockSourceService {
    addSource = addSourceMock;
    setCrawlStatus = setCrawlStatusMock;
    setConnectionStatus = setConnectionStatusMock;
    removeSource = removeSourceMock;
    getSources = vi.fn(() => []);
  }

  return {
    SourceService: MockSourceService,
  };
});

import { SourceService } from '@semantiqa/graph-service';

const baseRequest: SourcesAddRequest = {
  kind: 'postgres',
  name: 'Account DB',
  description: 'Primary transactional database',
  owners: ['owner@acme.com'],
  tags: ['prod', 'critical'],
  connection: {
    host: 'localhost',
    port: 5432,
    database: 'accounts',
    user: 'service',
    password: 'secret',
    ssl: true,
  },
};

describe('SourceProvisioningService', () => {
  let sourceService: SourceService;
  let secureStore: ReturnType<typeof vi.fn>;
  let triggerMetadataCrawl: ReturnType<typeof vi.fn>;
  let updateCrawlStatus: ReturnType<typeof vi.fn>;
  let updateConnectionStatus: ReturnType<typeof vi.fn>;
  let audit: ReturnType<typeof vi.fn>;
  let logger: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let service: SourceProvisioningService;

  beforeEach(() => {
    sourceService = new SourceService({
      openDatabase: () => ({}) as any,
    });
    vi.spyOn(sourceService, 'addSource').mockResolvedValue({ sourceId: 'src_test_123' });
    vi.spyOn(sourceService, 'setCrawlStatus').mockImplementation(() => undefined);
    vi.spyOn(sourceService, 'setConnectionStatus').mockImplementation(() => undefined);
    vi.spyOn(sourceService, 'removeSource').mockImplementation(() => undefined);

    secureStore = vi.fn().mockResolvedValue(undefined);
    triggerMetadataCrawl = vi.fn().mockResolvedValue(undefined);
    updateCrawlStatus = vi.fn().mockResolvedValue(undefined);
    updateConnectionStatus = vi.fn().mockResolvedValue(undefined);
    audit = vi.fn();
    logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    service = new SourceProvisioningService({
      openSourcesDb: () => ({}) as any,
      createSourceService: () => sourceService,
      triggerMetadataCrawl,
      secureStore,
      updateCrawlStatus,
      updateConnectionStatus,
      audit,
      logger,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('persists source, stores secrets, and triggers crawl', async () => {
    const result = await service.createSource(baseRequest);

    expect(result).toHaveProperty('sourceId');
    const { sourceId } = result as { sourceId: string };

    expect(secureStore).toHaveBeenCalledWith({ sourceId, key: 'password' }, 'secret');
    expect(triggerMetadataCrawl).toHaveBeenCalledWith(sourceId);

    expect(updateConnectionStatus).toHaveBeenCalledWith(sourceId, 'checking', undefined);
    expect(updateCrawlStatus).toHaveBeenNthCalledWith(1, sourceId, 'not_crawled', undefined);
    expect(updateCrawlStatus).toHaveBeenNthCalledWith(2, sourceId, 'crawling', undefined);

    const auditActions = audit.mock.calls.map(([event]) => event.action);
    expect(auditActions).toContain('sources.add.requested');
    expect(auditActions).toContain('sources.add.persisted');
    expect(auditActions).toContain('sources.add.crawl_triggered');
  });

  it('rolls back source when secret persistence fails', async () => {
    secureStore.mockRejectedValueOnce(new Error('keytar unavailable'));

    const result = await service.createSource(baseRequest);

    expect(result).toEqual({
      code: 'AUTH_REQUIRED',
      message: 'Unable to store credentials. Please verify keychain access and retry.',
    });

    const rows = sourceService.getSources();
    expect(rows.length).toBe(0);

    const auditActions = audit.mock.calls.map(([event]) => event.action);
    expect(auditActions).toContain('sources.add.secrets_failed');
    expect(auditActions).toContain('sources.add.rollback');
  });

  it('logs crawl failure but keeps source record', async () => {
    triggerMetadataCrawl.mockRejectedValueOnce(new Error('network issue'));

    const result = await service.createSource(baseRequest);
    expect(result).toHaveProperty('sourceId');

    const { sourceId } = result as { sourceId: string };

    const auditActions = audit.mock.calls.map(([event]) => event.action);
    expect(auditActions).toContain('sources.add.crawl_failed');
  });
});


