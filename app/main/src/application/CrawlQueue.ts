import { MetadataCrawlService } from './MetadataCrawlService';

interface CrawlJob {
  sourceId: string;
}

export class CrawlQueue {
  private readonly queue: CrawlJob[] = [];
  private running = false;

  constructor(private readonly crawlService: MetadataCrawlService) {}

  enqueue(sourceId: string) {
    this.queue.push({ sourceId });
    void this.process();
  }

  enqueueAll(sourceIds: string[]) {
    for (const id of sourceIds) {
      this.queue.push({ sourceId: id });
    }
    void this.process();
  }

  private async process() {
    if (this.running) {
      return;
    }
    this.running = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) {
        break;
      }

      try {
        await this.crawlService.crawlSource(job.sourceId);
      } catch (error) {
        console.error('Crawl job failed', job.sourceId, error);
      }
    }

    this.running = false;
  }
}
