/**
 * Types and interfaces for visual relationships and connections on the canvas
 */

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface ConnectionPoint {
  id: string;
  blockId: string;
  position: CanvasPoint;
  anchor: 'top' | 'right' | 'bottom' | 'left' | 'center';
  offset?: CanvasPoint; // Offset from block center
}

export interface VisualRelationship {
  id: string;
  sourcePoint: ConnectionPoint;
  targetPoint: ConnectionPoint;
  sourceBlockId: string;
  targetBlockId: string;
  sourceKind: string; // Data source type (postgres, mysql, etc.)
  targetKind: string;
  type: RelationshipType;
  style: RelationshipStyle;
  metadata?: RelationshipMetadata;
  selected?: boolean;
  hovered?: boolean;
}

export type RelationshipType = 'intra-source' | 'cross-source' | 'derived' | 'joins-to';

export interface RelationshipStyle {
  strokeWidth: number;
  strokeColor: string;
  strokeDasharray?: string; // For dashed lines
  opacity?: number;
  hoverColor?: string;
  selectedColor?: string;
  curve: CurveStyle;
}

export interface CurveStyle {
  type: 'bezier' | 'straight' | 'stepped';
  curvature: number; // 0-1, how curved the line is
  controlPointOffset?: number; // Distance of control points from endpoints
}

export interface RelationshipMetadata {
  label?: string;
  description?: string;
  strength?: number; // 0-1, confidence or importance
  tables?: string[]; // Related table names
  columns?: string[]; // Related column names
  cardinality?: '1:1' | '1:N' | 'N:1' | 'N:N';
  createdAt?: string;
  updatedAt?: string;
}

export interface BezierCurve {
  start: CanvasPoint;
  end: CanvasPoint;
  control1: CanvasPoint;
  control2: CanvasPoint;
  pathData: string; // SVG path d attribute
}

export interface RelationshipHitArea {
  relationshipId: string;
  path: Path2D | string;
  tolerance: number; // Pixels for hit detection
}

export interface RelationshipInteractionEvent {
  type: 'click' | 'double-click' | 'hover' | 'hover-end' | 'context-menu';
  relationshipId: string;
  position: CanvasPoint;
  originalEvent: MouseEvent | React.MouseEvent;
}

// Style presets for different relationship types
export const RELATIONSHIP_STYLE_PRESETS: Record<RelationshipType, RelationshipStyle> = {
  'intra-source': {
    strokeWidth: 2,
    strokeColor: 'rgba(139, 180, 247, 0.6)',
    strokeDasharray: '5,5',
    opacity: 0.8,
    hoverColor: 'rgba(91, 155, 244, 0.8)',
    selectedColor: 'rgba(59, 130, 246, 1)',
    curve: {
      type: 'bezier',
      curvature: 0.4,
      controlPointOffset: 100,
    },
  },
  'cross-source': {
    strokeWidth: 2.5,
    strokeColor: 'rgba(248, 113, 113, 0.6)',
    opacity: 0.9,
    hoverColor: 'rgba(239, 68, 68, 0.8)',
    selectedColor: 'rgba(220, 38, 38, 1)',
    curve: {
      type: 'bezier',
      curvature: 0.6,
      controlPointOffset: 120,
    },
  },
  'derived': {
    strokeWidth: 2,
    strokeColor: '#34d399',
    strokeDasharray: '8,4',
    opacity: 0.7,
    hoverColor: '#10b981',
    selectedColor: '#059669',
    curve: {
      type: 'bezier',
      curvature: 0.3,
      controlPointOffset: 80,
    },
  },
  'joins-to': {
    strokeWidth: 1.5,
    strokeColor: '#a78bfa',
    opacity: 0.6,
    hoverColor: '#8b5cf6',
    selectedColor: '#7c3aed',
    curve: {
      type: 'bezier',
      curvature: 0.5,
      controlPointOffset: 90,
    },
  },
};

// Utility functions
export function getRelationshipType(
  sourceKind: string, 
  targetKind: string, 
  sourceBlockId: string, 
  targetBlockId: string
): RelationshipType {
  if (sourceBlockId === targetBlockId) {
    return 'intra-source';
  }
  if (sourceKind === targetKind) {
    return 'cross-source';
  }
  return 'cross-source';
}

export function getStyleForRelationship(
  type: RelationshipType, 
  sourceKind: string,
  customizations?: Partial<RelationshipStyle>
): RelationshipStyle {
  const baseStyle = RELATIONSHIP_STYLE_PRESETS[type];
  
  // Apply source-specific color adjustments for intra-source relationships
  if (type === 'intra-source') {
    const sourceColors = {
      postgres: '#336791',
      mysql: '#e97627', 
      mongo: '#4db33d',
      duckdb: '#ff6b35',
    };
    const sourceColor = sourceColors[sourceKind as keyof typeof sourceColors] || baseStyle.strokeColor;
    baseStyle.strokeColor = sourceColor;
    baseStyle.hoverColor = adjustColorBrightness(sourceColor, -20);
    baseStyle.selectedColor = adjustColorBrightness(sourceColor, -40);
  }
  
  return {
    ...baseStyle,
    ...customizations,
  };
}

function adjustColorBrightness(color: string, amount: number): string {
  // Simple color adjustment - in production you might use a color library
  const hex = color.replace('#', '');
  const num = parseInt(hex, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, (num >> 8 & 0x00FF) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}