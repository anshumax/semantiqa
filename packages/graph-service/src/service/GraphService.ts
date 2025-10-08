import type { GraphGetRequest, GraphGetResponse } from '@semantiqa/contracts';

import { GraphRepository } from '../repository/GraphRepository';

export interface GraphServiceDependencies {
  openDatabase: () => unknown;
}

export class GraphService {
  private readonly deps: GraphServiceDependencies;
  private repository: GraphRepository | null = null;

  constructor(deps: GraphServiceDependencies) {
    this.deps = deps;
  }

  getSnapshot(request: GraphGetRequest): GraphGetResponse {
    if (!this.repository) {
      const database = this.deps.openDatabase();
      this.repository = new GraphRepository(database as any);
    }

    return this.repository.getGraph(request);
  }
}


