import { randomUUID } from 'node:crypto';
import type { SourcesAddRequest } from '@semantiqa/contracts';
import { SourceRepository } from '../repository/SourceRepository';

interface SourceServiceDeps {
  openDatabase: () => any;
}

export class SourceService {
  private repository: SourceRepository | null = null;

  constructor(private readonly deps: SourceServiceDeps) {}

  private ensureRepository() {
    if (!this.repository) {
      const database = this.deps.openDatabase();
      this.repository = new SourceRepository(database);
    }
    return this.repository;
  }

  async addSource(
    payload: SourcesAddRequest,
    initialCrawlStatus: 'not_crawled' | 'crawling' | 'crawled' | 'error' = 'not_crawled',
    initialConnectionStatus: 'unknown' | 'checking' | 'connected' | 'error' = 'unknown',
  ): Promise<{ sourceId: string }> {
    const repo = this.ensureRepository();
    const sourceId = `src_${payload.kind}_${randomUUID()}`;
    return repo.addSource(payload, sourceId, initialCrawlStatus, initialConnectionStatus);
  }

  setCrawlStatus(
    sourceId: string,
    status: 'not_crawled' | 'crawling' | 'crawled' | 'error',
    error?: { message: string; meta?: Record<string, unknown> },
  ): void {
    const repo = this.ensureRepository();
    repo.updateCrawlStatus(sourceId, status, error);
  }

  setConnectionStatus(
    sourceId: string,
    status: 'unknown' | 'checking' | 'connected' | 'error',
    errorMessage?: string,
  ): void {
    const repo = this.ensureRepository();
    repo.updateConnectionStatus(sourceId, status, errorMessage);
  }

  removeSource(sourceId: string): void {
    const repo = this.ensureRepository();
    repo.removeSource(sourceId);
  }
}

