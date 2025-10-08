import type { GraphGetRequest, GraphGetResponse } from '@semantiqa/contracts';
import { GraphService } from '@semantiqa/graph-service';

export interface GraphSnapshotServiceOptions {
  openDatabase: () => unknown;
}

export class GraphSnapshotService {
  private readonly graphService: GraphService;

  constructor(options: GraphSnapshotServiceOptions) {
    this.graphService = new GraphService({ openDatabase: options.openDatabase });
  }

  getSnapshot(request: GraphGetRequest): GraphGetResponse {
    return this.graphService.getSnapshot(request);
  }
}


