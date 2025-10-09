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
    // Load regular nodes
    const nodeRows = this.db.prepare('SELECT id, type, props, origin_device_id, created_at, updated_at FROM nodes').all();
    
    // Load source nodes from sources table
    const sourceRows = this.db.prepare('SELECT id, name, kind, config, owners, tags, created_at FROM sources').all();
    
    const edgeRows = this.db.prepare('SELECT id, src_id, dst_id, type, props, created_at, updated_at FROM edges').all();

    const nodes = nodeRows.map(mapNode);
    
    // Map sources to nodes
    const sourceNodes: GraphNode[] = sourceRows.map((row: any) => {
      const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config ?? {};
      const owners = typeof row.owners === 'string' ? JSON.parse(row.owners) : row.owners ?? [];
      const tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags ?? [];
      
      return {
        id: row.id,
        type: 'source' as const,
        props: {
          displayName: row.name,
          description: config.description,
          owners,
          tags,
          sensitivity: 'internal' as const,
          status: 'draft' as const,
          kind: row.kind, // Additional prop for source kind
        } as any, // Type assertion needed because kind is not in GraphNodeProps schema
        createdAt: row.created_at,
        updatedAt: row.created_at,
      } satisfies GraphNode;
    });
    
    const allNodes = [...sourceNodes, ...nodes];
    const edges = edgeRows.map(mapEdge);

    return {
      nodes: allNodes,
      edges,
      stats: {
        nodeCount: allNodes.length,
        edgeCount: edges.length,
      },
    } satisfies GraphGetResponse;
  }
}


