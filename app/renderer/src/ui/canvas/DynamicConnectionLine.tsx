import React from 'react';
import { ConnectionCreationState } from './connectionTypes';
import { calculateBezierCurve } from './curveUtils';
import { CanvasPosition } from './types';
import { ConnectionPoint } from './relationshipTypes';

export interface DynamicConnectionLineProps {
  connectionState: ConnectionCreationState;
  className?: string;
}

export function DynamicConnectionLine({ 
  connectionState, 
  className = '' 
}: DynamicConnectionLineProps) {
  // Hooks must be at the top level - before any early returns
  const svgRef = React.useRef<SVGSVGElement>(null);
  
  // Debug logging - only essential logs
  React.useEffect(() => {
    if (svgRef.current) {
      console.log('DynamicConnectionLine: SVG ref attached successfully');
    }
  }, [connectionState.isConnecting]);

  // Don't render if not in connection mode
  if (!connectionState.isConnecting || 
      !connectionState.sourcePosition || 
      !connectionState.cursorPosition) {
    return null;
  }

  // Calculate the bezier curve from source to cursor position
  const curve = calculateBezierCurve(
    {
      id: 'source',
      blockId: 'source',
      position: connectionState.sourcePosition as { x: number; y: number },
      anchor: 'right'
    },
    {
      id: 'cursor',
      blockId: 'cursor',
      position: connectionState.cursorPosition as { x: number; y: number },
      anchor: 'left'
    },
    {
      type: 'bezier',
      curvature: 0.3,
      controlPointOffset: 80
    }
  );
  
  const pathData = curve.pathData;
  
  // Fallback: simple straight line if curve calculation fails
  const fallbackPath = `M ${connectionState.sourcePosition.x} ${connectionState.sourcePosition.y} L ${connectionState.cursorPosition.x} ${connectionState.cursorPosition.y}`;
  const finalPath = pathData || fallbackPath;
  

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000,
        overflow: 'visible'
      }}
      className={className}
    >
      <path
        d={finalPath}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={2}
        strokeDasharray="5,5"
        opacity={0.8}
      />
    </svg>
  );
}