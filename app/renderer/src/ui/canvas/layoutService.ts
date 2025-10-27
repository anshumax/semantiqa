import dagre from 'dagre';
import { Node, Edge } from 'reactflow';

export interface LayoutOptions {
  direction?: 'TB' | 'BT' | 'LR' | 'RL'; // Top-Bottom, Bottom-Top, Left-Right, Right-Left
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number; // Separation between ranks (layers)
  nodeSep?: number; // Separation between nodes in same rank
  edgeSep?: number; // Separation between edges
}

const DEFAULT_OPTIONS: Required<LayoutOptions> = {
  direction: 'TB',
  nodeWidth: 250,
  nodeHeight: 120,
  rankSep: 150,
  nodeSep: 100,
  edgeSep: 50,
};

/**
 * Applies force-directed graph layout using dagre algorithm
 * @param nodes - Array of ReactFlow nodes
 * @param edges - Array of ReactFlow edges
 * @param options - Layout configuration options
 * @returns Array of nodes with updated positions
 */
export function applyAutoLayout<T = any>(
  nodes: Node<T>[],
  edges: Edge[],
  options: LayoutOptions = {}
): Node<T>[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Create a new directed graph
  const g = new dagre.graphlib.Graph();
  
  // Set graph options
  g.setGraph({
    rankdir: opts.direction,
    nodesep: opts.nodeSep,
    edgesep: opts.edgeSep,
    ranksep: opts.rankSep,
  });
  
  // Default edge configuration
  g.setDefaultEdgeLabel(() => ({}));
  
  // Add nodes to the graph
  nodes.forEach((node) => {
    g.setNode(node.id, { 
      width: opts.nodeWidth, 
      height: opts.nodeHeight 
    });
  });
  
  // Add edges to the graph
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });
  
  // Run the layout algorithm
  dagre.layout(g);
  
  // Update node positions based on layout
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    
    // Dagre returns center positions, ReactFlow expects top-left positions
    // So we need to subtract half the node dimensions
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - opts.nodeWidth / 2,
        y: nodeWithPosition.y - opts.nodeHeight / 2,
      },
    };
  });
  
  return layoutedNodes;
}

/**
 * Calculates bounding box of all nodes
 */
export function getNodesBoundingBox(nodes: Node[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  
  nodes.forEach((node) => {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x);
    maxY = Math.max(maxY, node.position.y);
  });
  
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Centers the layout in the viewport
 */
export function centerLayout<T = any>(
  nodes: Node<T>[],
  viewportWidth: number = 1200,
  viewportHeight: number = 800
): Node<T>[] {
  if (nodes.length === 0) return nodes;
  
  const bbox = getNodesBoundingBox(nodes);
  
  // Calculate offset to center the layout
  const offsetX = (viewportWidth - bbox.width) / 2 - bbox.minX;
  const offsetY = (viewportHeight - bbox.height) / 2 - bbox.minY;
  
  // Apply offset to all nodes
  return nodes.map((node) => ({
    ...node,
    position: {
      x: node.position.x + offsetX,
      y: node.position.y + offsetY,
    },
  }));
}

/**
 * Calculate optimal connection handles based on relative positions of nodes
 */
export function calculateOptimalHandles(
  sourceNode: Node,
  targetNode: Node,
  nodeWidth: number = 250,
  nodeHeight: number = 120
): { sourceHandle: string; targetHandle: string } {
  // Calculate center positions of both nodes
  const sourceCenterX = sourceNode.position.x + nodeWidth / 2;
  const sourceCenterY = sourceNode.position.y + nodeHeight / 2;
  const targetCenterX = targetNode.position.x + nodeWidth / 2;
  const targetCenterY = targetNode.position.y + nodeHeight / 2;
  
  // Calculate relative position
  const deltaX = targetCenterX - sourceCenterX;
  const deltaY = targetCenterY - sourceCenterY;
  
  // Determine primary direction (horizontal vs vertical)
  // Use absolute values to determine which axis has more separation
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  
  let sourceHandle: string;
  let targetHandle: string;
  
  // If horizontal separation is greater, prioritize horizontal connections
  if (absX > absY) {
    if (deltaX > 0) {
      // Target is to the right of source
      sourceHandle = 'right';
      targetHandle = 'left';
    } else {
      // Target is to the left of source
      sourceHandle = 'left';
      targetHandle = 'right';
    }
  } else {
    // Vertical separation is greater, prioritize vertical connections
    if (deltaY > 0) {
      // Target is below source
      sourceHandle = 'bottom';
      targetHandle = 'top';
    } else {
      // Target is above source
      sourceHandle = 'top';
      targetHandle = 'bottom';
    }
  }
  
  return { sourceHandle, targetHandle };
}

/**
 * Update edge handles based on node positions
 */
export function updateEdgeHandles(
  nodes: Node[],
  edges: Edge[],
  nodeWidth: number = 250,
  nodeHeight: number = 120
): Edge[] {
  // Create a map for quick node lookup
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  
  // Update each edge with optimal handles
  return edges.map(edge => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    
    if (!sourceNode || !targetNode) {
      // If nodes not found, return edge unchanged
      return edge;
    }
    
    const { sourceHandle, targetHandle } = calculateOptimalHandles(
      sourceNode,
      targetNode,
      nodeWidth,
      nodeHeight
    );
    
    return {
      ...edge,
      sourceHandle,
      targetHandle,
    };
  });
}

