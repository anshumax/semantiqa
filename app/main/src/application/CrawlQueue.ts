import type { MetadataCrawlService } from './MetadataCrawlService';

export type CrawlQueueStatus =
  | { status: 'queued' }
  | { status: 'running' }
  | { status: 'completed' }
  | { status: 'failed'; error: Error };

interface CrawlJob {
  sourceId: string;
}

interface CrawlQueueDeps {
  crawlService: MetadataCrawlService;
  notifyStatus: (sourceId: string, status: CrawlQueueStatus) => void;
  logger: {
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
  };
}

export class CrawlQueue {
  private readonly queue: CrawlJob[] = [];
  private readonly pending = new Set<string>();
  private running = false;

  constructor(private readonly deps: CrawlQueueDeps) {}

  enqueue(sourceId: string): { queued: boolean } {
    if (this.pending.has(sourceId)) {
      this.deps.logger.info('Crawl already pending', { sourceId });
      return { queued: false };
    }

    this.pending.add(sourceId);
    this.queue.push({ sourceId });
    this.deps.notifyStatus(sourceId, { status: 'queued' });
    void this.process();
    return { queued: true };
  }

  enqueueAll(sourceIds: string[]): number {
    let queuedCount = 0;
    for (const id of sourceIds) {
      const result = this.enqueue(id);
      if (result.queued) {
        queuedCount += 1;
      }
    }
    return queuedCount;
  }

  private async process() {
    if (this.running) {
      return;
    }
    this.running = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) {
        continue;
      }

      const { sourceId } = job;

      this.deps.notifyStatus(sourceId, { status: 'running' });

      try {
        const result = await this.deps.crawlService.crawlSource(sourceId);
        if (result && typeof result === 'object' && 'code' in result) {
          const error = new Error((result as { message: string }).message);
          this.deps.logger.warn('Crawl reported error', { sourceId, error: result });
          this.deps.notifyStatus(sourceId, { status: 'failed', error });
        } else {
          this.deps.notifyStatus(sourceId, { status: 'completed' });
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown crawl error');
        this.deps.logger.error('Crawl job failed', { sourceId, error: err });
        this.deps.notifyStatus(sourceId, { status: 'failed', error: err });
      } finally {
        this.pending.delete(sourceId);
      }
    }

    this.running = false;
  }
}
