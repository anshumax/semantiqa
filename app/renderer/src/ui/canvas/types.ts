// Canvas viewport state
export interface CanvasViewport {
  zoom: number;
  centerX: number;
  centerY: number;
}

// Canvas position
export interface CanvasPosition {
  x: number;
  y: number;
}

// Canvas size
export interface CanvasSize {
  width: number;
  height: number;
}

// Canvas bounds/rectangle
export interface CanvasBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Canvas block/node interface
export interface CanvasNode {
  id: string;
  position: CanvasPosition;
  size: CanvasSize;
  zIndex?: number;
  selected?: boolean;
  dragging?: boolean;
  data?: any;
}

// Canvas connection/edge interface
export interface CanvasConnection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
  selected?: boolean;
  data?: any;
}

// Canvas interaction modes
export type CanvasInteractionMode = 
  | 'select'
  | 'pan' 
  | 'connect'
  | 'zoom';

// Canvas events
export interface CanvasNodeEvent {
  node: CanvasNode;
  event: React.MouseEvent;
}

export interface CanvasConnectionEvent {
  connection: CanvasConnection;
  event: React.MouseEvent;
}

export interface CanvasBackgroundEvent {
  position: CanvasPosition;
  event: React.MouseEvent;
}

// Canvas state
export interface CanvasState {
  viewport: CanvasViewport;
  nodes: CanvasNode[];
  connections: CanvasConnection[];
  selectedNodes: string[];
  selectedConnections: string[];
  interactionMode: CanvasInteractionMode;
  isDragging: boolean;
  isConnecting: boolean;
}

// Canvas configuration
export interface CanvasConfig {
  gridSize: number;
  snapToGrid: boolean;
  minZoom: number;
  maxZoom: number;
  panBoundary?: CanvasBounds;
  enableMultiSelect: boolean;
  enableKeyboardShortcuts: boolean;
}

// Canvas theme
export interface CanvasTheme {
  background: string;
  gridColor: string;
  nodeBackground: string;
  nodeStroke: string;
  connectionStroke: string;
  selectionColor: string;
}