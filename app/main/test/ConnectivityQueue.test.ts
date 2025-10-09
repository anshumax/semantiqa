import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConnectivityCheckResult } from '../src/application/ConnectivityService';
import { ConnectivityQueue } from '../src/application/ConnectivityService';

describe('ConnectivityQueue', () => {
  const broadcastStatus = vi.fn();
  const mapStatus = vi.fn((status: 'unknown' | 'checking' | 'connected' | 'error', error?: { message: string }) => ({
    status: status === 'connected' ? 'ready' : status === 'error' ? 'needs_attention' : 'connecting',
    error,
  }));
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const service = {
    listSourceIds: vi.fn<string[], []>(() => ['src_a', 'src_b']),
    checkSource: vi.fn<Promise<ConnectivityCheckResult>, [string]>(),
  };

  let queue: ConnectivityQueue;

  beforeEach(() => {
    vi.useFakeTimers();
    broadcastStatus.mockReset();
    mapStatus.mockClear();
    logger.info.mockReset();
    logger.error.mockReset();
    (service.listSourceIds as any).mockReturnValue(['src_a', 'src_b']);
    (service.checkSource as any).mockResolvedValue({ status: 'connected' });

    queue = new ConnectivityQueue({
      service: service as any,
      broadcastStatus,
      mapStatus,
      logger,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('queues connectivity check and emits status transitions', async () => {
    (service.checkSource as any).mockImplementation(async () => {
      await Promise.resolve();
      return { status: 'connected' } satisfies ConnectivityCheckResult;
    });

    const result = queue.queueCheck('src_a');
    expect(result).toEqual({ queued: true });

    await vi.runAllTimersAsync();

    expect(service.checkSource).toHaveBeenCalledWith('src_a');
    expect(broadcastStatus).toHaveBeenCalledWith('src_a', expect.objectContaining({ status: 'connecting' }));
    expect(broadcastStatus).toHaveBeenCalledWith('src_a', expect.objectContaining({ status: 'ready' }));
  });

  it('refuses duplicate queue entries for same source', () => {
    const first = queue.queueCheck('src_a');
    const second = queue.queueCheck('src_a');

    expect(first).toEqual({ queued: true });
    expect(second).toEqual({ queued: false });
    expect(logger.info).toHaveBeenCalledWith('Connectivity check already queued', { sourceId: 'src_a' });
  });

  it('emits error status when connectivity check fails', async () => {
    (service.checkSource as any).mockResolvedValueOnce({ status: 'error', message: 'network' });

    queue.queueCheck('src_a');
    await vi.runAllTimersAsync();

    expect(broadcastStatus).toHaveBeenCalledWith('src_a', expect.objectContaining({ status: 'needs_attention' }));
  });

  it('queues all sources during startup sweep', async () => {
    (service.checkSource as any).mockResolvedValue({ status: 'connected' });
    const result = await queue.queueStartupSweep();
    expect(result).toBe(2);

    await vi.runAllTimersAsync();
    expect(service.checkSource).toHaveBeenCalledTimes(2);
  });
});


