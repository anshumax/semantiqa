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

  async addSource(payload: SourcesAddRequest): Promise<{ sourceId: string }> {
    const repo = this.ensureRepository();
    const sourceId = `src_${payload.kind}_${randomUUID()}`;
    return repo.addSource(payload, sourceId);
  }

  removeSource(sourceId: string): void {
    const repo = this.ensureRepository();
    repo.removeSource(sourceId);
  }
}

