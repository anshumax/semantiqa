import type { GraphEdge, GraphGetRequest, GraphGetResponse, GraphNode } from '@semantiqa/contracts';

function mapNode(row: any): GraphNode {
  const props = typeof row.props === 'string' ? JSON.parse(row.props) : row.props ?? {};
  return {
    id: row.id,
    type: row.type,
    props,
    originDeviceId: row.origin_device_id ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  } satisfies GraphNode;
}

function mapEdge(row: any): GraphEdge {
  const props = typeof row.props === 'string' ? JSON.parse(row.props) : row.props ?? {};
  return {
    id: row.id,
    srcId: row.src_id,
    dstId: row.dst_id,
    type: row.type,
    props,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  } satisfies GraphEdge;
}

export class GraphRepository {
  constructor(private readonly db: { prepare: (sql: string) => { all: () => any[] } }) {}

  getGraph(_request: GraphGetRequest): GraphGetResponse {
    const nodeRows = this.db.prepare('SELECT id, type, props, origin_device_id, created_at, updated_at FROM nodes').all();
    const edgeRows = this.db.prepare('SELECT id, src_id, dst_id, type, props, created_at, updated_at FROM edges').all();

    const nodes = nodeRows.map(mapNode);
    const edges = edgeRows.map(mapEdge);

    return {
      nodes,
      edges,
      stats: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
      },
    } satisfies GraphGetResponse;
  }
}


