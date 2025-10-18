import React, { useState, useCallback } from 'react';
import { Canvas } from './Canvas';
import { CanvasBlock } from './CanvasBlock';
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
          {/* Canvas blocks representing data sources */}
          <DemoCanvasBlocks />
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

// Demo canvas blocks using CanvasBlock component
function DemoCanvasBlocks() {
  const demoDataSources = [
    {
      id: 'demo-pg-1',
      kind: 'postgres' as const,
      name: 'Production DB',
      database: 'ecommerce_prod',
      status: 'connected' as const,
      tableCount: 23,
      x: -100,
      y: -60,
    },
    {
      id: 'demo-mongo-1',
      kind: 'mongo' as const,
      name: 'User Analytics',
      database: 'analytics',
      status: 'crawling' as const,
      tableCount: 7,
      x: 150,
      y: -60,
    },
    {
      id: 'demo-duckdb-1',
      kind: 'duckdb' as const,
      name: 'Data Warehouse',
      database: 'warehouse.duckdb',
      status: 'connected' as const,
      tableCount: 15,
      x: 25,
      y: 100,
    },
    {
      id: 'demo-mysql-1',
      kind: 'mysql' as const,
      name: 'Legacy System',
      database: 'legacy_crm',
      status: 'error' as const,
      error: 'Connection timeout',
      x: -150,
      y: 120,
    },
  ];

  return (
    <>
      {demoDataSources.map((source) => (
        <CanvasBlock
          key={source.id}
          id={source.id}
          kind={source.kind}
          name={source.name}
          database={source.database}
          status={source.status}
          tableCount={source.tableCount}
          x={source.x}
          y={source.y}
          width={200}
          height={120}
          error={source.error}
          selected={false}
          onPositionChange={(id, newX, newY) => {
            console.log(`Block ${id} moved to (${newX}, ${newY})`);
          }}
          onClick={(id) => {
            console.log(`Block ${id} clicked`);
          }}
          onDoubleClick={(id) => {
            console.log(`Block ${id} double-clicked - should drill down`);
          }}
          onContextMenu={(id) => {
            console.log(`Block ${id} right-clicked - show context menu`);
          }}
        />
      ))}

      {/* Demo connection lines */}
      <svg
        style={{
          position: 'absolute',
          left: '0',
          top: '0',
          width: '500px',
          height: '300px',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        {/* Connection from PostgreSQL to MongoDB */}
        <path
          d="M 100 0 Q 200 50 250 0"
          stroke="#8bb4f7"
          strokeWidth="2"
          fill="none"
          strokeDasharray="5,5"
        />
        {/* Connection from MongoDB to DuckDB */}
        <path
          d="M 250 60 Q 180 130 125 160"
          stroke="#8bb4f7"
          strokeWidth="2"
          fill="none"
          strokeDasharray="5,5"
        />
        {/* Connection from PostgreSQL to MySQL */}
        <path
          d="M 0 60 Q -75 90 -50 180"
          stroke="#f87171"
          strokeWidth="2"
          fill="none"
          strokeDasharray="8,4"
          opacity="0.7"
        />
      </svg>
    </>
  );
}
