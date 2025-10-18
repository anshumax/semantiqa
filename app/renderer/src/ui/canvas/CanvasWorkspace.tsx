import React, { useState, useCallback } from 'react';
import { Canvas } from './Canvas';
import { CanvasViewport } from './types';
import './CanvasWorkspace.css';

export interface CanvasWorkspaceProps {
  className?: string;
}

export function CanvasWorkspace({ className = '' }: CanvasWorkspaceProps) {
  const [viewport, setViewport] = useState<CanvasViewport>({
    zoom: 1.0,
    centerX: 0,
    centerY: 0,
  });

  const handleViewportChange = useCallback((newViewport: CanvasViewport) => {
    setViewport(newViewport);
  }, []);

  const resetViewport = useCallback(() => {
    setViewport({
      zoom: 1.0,
      centerX: 0,
      centerY: 0,
    });
  }, []);

  return (
    <div className={`canvas-workspace ${className}`}>
      {/* Canvas header with controls */}
      <div className="canvas-workspace__header">
        <h1 className="canvas-workspace__title">Canvas Workspace</h1>
        <div className="canvas-workspace__controls">
          <button 
            className="canvas-workspace__control-btn"
            onClick={resetViewport}
            title="Reset viewport (0)"
          >
            Reset View
          </button>
          <span className="canvas-workspace__viewport-info">
            Zoom: {Math.round(viewport.zoom * 100)}% | 
            Center: ({Math.round(viewport.centerX)}, {Math.round(viewport.centerY)})
          </span>
        </div>
      </div>

      {/* Main canvas area */}
      <div className="canvas-workspace__content">
        <Canvas
          viewport={viewport}
          onViewportChange={handleViewportChange}
          gridSize={20}
          minZoom={0.1}
          maxZoom={3.0}
        >
          {/* Demo content - placeholder blocks */}
          <DemoCanvasContent />
        </Canvas>
      </div>

      {/* Instructions overlay */}
      <div className="canvas-workspace__instructions">
        <div className="instructions-panel">
          <h3>Canvas Controls</h3>
          <ul>
            <li><strong>Mouse wheel:</strong> Zoom in/out</li>
            <li><strong>Middle mouse / Shift+Drag:</strong> Pan canvas</li>
            <li><strong>+ / -:</strong> Zoom with keyboard</li>
            <li><strong>0:</strong> Reset zoom to 100%</li>
          </ul>
          <p className="instructions-note">
            This is a preview of the canvas infrastructure. Data source blocks and relationships will be added in the next tasks.
          </p>
        </div>
      </div>
    </div>
  );
}

// Demo content to show canvas functionality
function DemoCanvasContent() {
  return (
    <>
      {/* Demo blocks to showcase positioning and zoom */}
      <div 
        className="demo-block"
        style={{
          position: 'absolute',
          left: '-100px',
          top: '-60px',
          width: '200px',
          height: '120px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold',
          boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
        }}
      >
        PostgreSQL Demo
      </div>
      
      <div 
        className="demo-block"
        style={{
          position: 'absolute',
          left: '150px',
          top: '-60px',
          width: '200px',
          height: '120px',
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold',
          boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
        }}
      >
        MongoDB Demo
      </div>
      
      <div 
        className="demo-block"
        style={{
          position: 'absolute',
          left: '25px',
          top: '100px',
          width: '200px',
          height: '120px',
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold',
          boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
        }}
      >
        DuckDB Demo
      </div>

      {/* Demo connection line */}
      <svg
        style={{
          position: 'absolute',
          left: '0',
          top: '0',
          width: '400px',
          height: '300px',
          pointerEvents: 'none',
        }}
      >
        <path
          d="M 100 0 Q 200 50 250 0"
          stroke="#8bb4f7"
          strokeWidth="2"
          fill="none"
          strokeDasharray="5,5"
        />
        <path
          d="M 200 60 Q 150 130 125 160"
          stroke="#8bb4f7"
          strokeWidth="2"
          fill="none"
          strokeDasharray="5,5"
        />
      </svg>
    </>
  );
}