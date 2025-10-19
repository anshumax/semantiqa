import React from 'react';
import { ConnectionCreationState } from './connectionTypes';
import { calculateBezierCurve } from './curveUtils';
import { CanvasPosition } from './types';

export interface DynamicConnectionLineProps {
  connectionState: ConnectionCreationState;
  className?: string;
}

export function DynamicConnectionLine({ 
  connectionState, 
  className = '' 
}: DynamicConnectionLineProps) {
  // Debug logging to see what's happening
  React.useEffect(() => {
    console.log('💾 DynamicConnectionLine state:', {
      isConnecting: connectionState.isConnecting,
      hasSourcePosition: !!connectionState.sourcePosition,
      hasCursorPosition: !!connectionState.cursorPosition,
      sourcePosition: connectionState.sourcePosition,
      cursorPosition: connectionState.cursorPosition
    });
  }, [connectionState]);

  // Don't render if not in connection mode
  if (!connectionState.isConnecting || 
      !connectionState.sourcePosition || 
      !connectionState.cursorPosition) {
    console.log('🙅 DynamicConnectionLine not rendering - missing required data');
    return null;
  }
  
  console.log('✨ DynamicConnectionLine rendering with data');

  // Calculate the bezier curve from source to cursor position
  const curve = calculateBezierCurve(
    {
      id: 'source',
      blockId: 'source',
      position: connectionState.sourcePosition,
      anchor: 'right'
    },
    {
      id: 'cursor',
      blockId: 'cursor',
      position: connectionState.cursorPosition,
      anchor: 'left'
    },
    {
      curvature: 0.3,
      controlPointOffset: 80
    }
  );
  
  const pathData = curve.pathData;

  return (
    <svg
      className={`dynamic-connection-line ${className}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      <defs>
        {/* Animated dash pattern for connection in progress */}
        <pattern
          id="animated-dash"
          patternUnits="userSpaceOnUse"
          width="20"
          height="2"
          patternTransform="rotate(0)"
        >
          <rect width="10" height="2" fill="var(--color-accent-blue)" opacity="0.6" />
          <rect x="10" width="10" height="2" fill="transparent" />
          <animateTransform
            attributeName="patternTransform"
            attributeType="XML"
            type="translate"
            values="0,0; 20,0; 0,0"
            dur="1s"
            repeatCount="indefinite"
          />
        </pattern>
      </defs>
      
      {/* Connection line path */}
      <path
        d={pathData}
        stroke="url(#animated-dash)"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.8}
      />
      
      {/* Connection source indicator */}
      <circle
        cx={connectionState.sourcePosition.x}
        cy={connectionState.sourcePosition.y}
        r="5"
        fill="rgba(59, 130, 246, 0.9)"
        stroke="white"
        strokeWidth="2"
      >
        <animate
          attributeName="r"
          values="5;7;5"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
      
      {/* Connection cursor indicator */}
      <circle
        cx={connectionState.cursorPosition.x}
        cy={connectionState.cursorPosition.y}
        r="4"
        fill="rgba(59, 130, 246, 0.7)"
        stroke="rgba(255, 255, 255, 0.8)"
        strokeWidth="1"
        opacity={0.8}
      >
        <animate
          attributeName="r"
          values="4;6;4"
          dur="1s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.8;1;0.8"
          dur="1s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}