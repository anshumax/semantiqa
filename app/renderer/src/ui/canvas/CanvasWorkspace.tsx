import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Canvas } from './Canvas';
import { CanvasBlock } from './CanvasBlock';
import { TableBlock } from './TableBlock';
import { CanvasBreadcrumbs } from './CanvasBreadcrumbs';
import { CanvasNavigationProvider, useCanvasNavigation } from './CanvasNavigationContext';
import { CanvasFloatingUI, FloatingElement } from './CanvasFloatingUI';
import { FloatingPlusButton } from './FloatingPlusButton';
import { ZoomControls } from './ZoomControls';
import { CanvasMiniMap } from './CanvasMiniMap';
import { RelationshipRenderer } from './RelationshipRenderer';
import { DynamicConnectionLine } from './DynamicConnectionLine';
import { ConnectionModal } from './ConnectionModal';
import { 
  VisualRelationship, 
  getRelationshipType, 
  getStyleForRelationship,
  RelationshipInteractionEvent
} from './relationshipTypes';
import { getConnectionPointPosition, calculateOptimalConnectionPoints } from './curveUtils';
import { CanvasViewport } from './types';
import { DrillDownContext, createDefaultTransition } from './navigationTypes';
import { ConnectionCreationState, PendingConnection } from './connectionTypes';
import './CanvasWorkspace.css';

export interface CanvasWorkspaceProps {
  className?: string;
}

export function CanvasWorkspace({ className = '' }: CanvasWorkspaceProps) {
  return (
    <CanvasNavigationProvider>
      <CanvasWorkspaceContent className={className} />
    </CanvasNavigationProvider>
  );
}

function CanvasWorkspaceContent({ className = '' }: CanvasWorkspaceProps) {
  const [viewport, setViewport] = useState<CanvasViewport>({
    zoom: 1.0,
    centerX: 0,
    centerY: 0,
  });
  
  const [showHelpModal, setShowHelpModal] = useState(false);
  
  // Connection creation state
  const [connectionState, setConnectionState] = useState<ConnectionCreationState>({
    isConnecting: false,
    sourceBlockId: null,
    sourcePosition: null,
    cursorPosition: null,
    targetBlockId: null,
    targetPosition: null,
  });
  
  const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null);
  const [connectionModal, setConnectionModal] = useState<{
    isOpen: boolean;
    sourceBlock?: { id: string; name: string; kind: string };
    targetBlock?: { id: string; name: string; kind: string };
  }>({ isOpen: false });
  const canvasRef = useRef<HTMLDivElement>(null);
  
  const { state, drillDown, navigateToBreadcrumb } = useCanvasNavigation();

  const handleViewportChange = useCallback((newViewport: CanvasViewport) => {
    setViewport(newViewport);
  }, []);
  
  // Reset and animate viewport when level changes
  React.useEffect(() => {
    if (state.isTransitioning && state.activeTransition) {
      const transition = state.activeTransition;
      
      // Smooth zoom transition based on navigation direction
      if (transition.type === 'drill-down') {
        // Zoom in slightly when drilling down
        setViewport(prev => ({
          ...prev,
          zoom: Math.min(prev.zoom * 1.2, 2.0),
          centerX: 0,
          centerY: 0,
        }));
      } else if (transition.type === 'drill-up') {
        // Zoom out when drilling up
        setViewport(prev => ({
          ...prev,
          zoom: Math.max(prev.zoom * 0.8, 0.5),
          centerX: 0,
          centerY: 0,
        }));
      }
    }
  }, [state.currentLevel, state.isTransitioning, state.activeTransition]);

  const resetViewport = useCallback(() => {
    setViewport({
      zoom: 1.0,
      centerX: 0,
      centerY: 0,
    });
  }, []);
  
  // Zoom control handlers
  const handleZoomIn = useCallback(() => {
    setViewport(prev => ({
      ...prev,
      zoom: Math.min(prev.zoom * 1.2, 3.0)
    }));
  }, []);
  
  const handleZoomOut = useCallback(() => {
    setViewport(prev => ({
      ...prev,
      zoom: Math.max(prev.zoom / 1.2, 0.1)
    }));
  }, []);
  
  const handleZoomReset = useCallback(() => {
    setViewport(prev => ({
      ...prev,
      zoom: 1.0
    }));
  }, []);
  
  // Plus button handler with user feedback
  const handleAddDataSource = useCallback(() => {
    console.log('Add data source clicked - will open connection wizard');
    // TODO: Integrate with actual connection wizard when available
    
    // Provide temporary user feedback while wizard is not implemented
    alert('Add Data Source functionality will open a connection wizard.\n\nThis feature is currently being developed.');
  }, []);
  
  // Relationship interaction handler
  const handleRelationshipInteraction = useCallback((event: RelationshipInteractionEvent) => {
    console.log('Relationship interaction:', event.type, event.relationshipId);
    
    switch (event.type) {
      case 'hover':
        console.log('Hovering over relationship:', event.relationshipId);
        break;
      case 'click':
        console.log('Clicked relationship:', event.relationshipId);
        break;
      case 'double-click':
        console.log('Double-clicked relationship - open editor:', event.relationshipId);
        break;
      case 'context-menu':
        console.log('Right-clicked relationship - show menu:', event.relationshipId);
        break;
    }
  }, []);
  
  // Connection creation handlers
  const handleConnectionStart = useCallback((sourceBlockId: string, sourcePosition: CanvasPosition) => {
    console.log('🔗 Connection start:', { sourceBlockId, sourcePosition });
    
    setConnectionState({
      isConnecting: true,
      sourceBlockId,
      sourcePosition,
      cursorPosition: sourcePosition,
      targetBlockId: null,
      targetPosition: null,
    });
    
    console.log('🔗 Connection state updated to connecting mode');
  }, []);
  
  const handleConnectionTarget = useCallback((targetBlockId: string, targetPosition: CanvasPosition) => {
    console.log('🎯 Connection target:', { targetBlockId, targetPosition });
    setConnectionState(prev => ({
      ...prev,
      targetBlockId,
      targetPosition,
    }));
  }, []);
  
  const handleConnectionTargetLeave = useCallback(() => {
    setConnectionState(prev => ({
      ...prev,
      targetBlockId: null,
      targetPosition: null,
    }));
  }, []);
  
  const handleCancelConnection = useCallback(() => {
    console.log('Cancelling connection');
    setConnectionState({
      isConnecting: false,
      sourceBlockId: null,
      sourcePosition: null,
      cursorPosition: null,
      targetBlockId: null,
      targetPosition: null,
    });
  }, []);
  
  const handleCompleteConnection = useCallback(() => {
    if (connectionState.sourceBlockId && connectionState.targetBlockId && 
        connectionState.sourcePosition && connectionState.targetPosition) {
      
      // Prevent self-connection
      if (connectionState.sourceBlockId === connectionState.targetBlockId) {
        console.warn('Cannot create connection to the same block');
        handleCancelConnection();
        return;
      }
      
      // Find source and target block info
      const sourceBlock = demoDataSources.find(ds => ds.id === connectionState.sourceBlockId);
      const targetBlock = demoDataSources.find(ds => ds.id === connectionState.targetBlockId);
      
      if (!sourceBlock || !targetBlock) {
        console.error('Source or target block not found');
        handleCancelConnection();
        return;
      }
      
      // Check if both blocks are in a valid state for connection
      if (sourceBlock.status === 'error' || targetBlock.status === 'error') {
        console.warn('Cannot create connection with blocks in error state');
        // Could show a toast or modal here instead of just canceling
        handleCancelConnection();
        return;
      }
      
      // Open connection configuration modal
      setConnectionModal({
        isOpen: true,
        sourceBlock: {
          id: sourceBlock.id,
          name: sourceBlock.name,
          kind: sourceBlock.kind
        },
        targetBlock: {
          id: targetBlock.id,
          name: targetBlock.name,
          kind: targetBlock.kind
        }
      });
      
      const newConnection: PendingConnection = {
        sourceBlockId: connectionState.sourceBlockId,
        targetBlockId: connectionState.targetBlockId,
        sourcePosition: connectionState.sourcePosition,
        targetPosition: connectionState.targetPosition,
      };
      
      setPendingConnection(newConnection);
      console.log('Connection created between:', sourceBlock.name, 'and', targetBlock.name);
    } else {
      console.warn('Incomplete connection state - missing required data');
    }
    
    // Reset connection state
    setConnectionState({
      isConnecting: false,
      sourceBlockId: null,
      sourcePosition: null,
      cursorPosition: null,
      targetBlockId: null,
      targetPosition: null,
    });
  }, [connectionState, handleCancelConnection]);
  
  // Mouse move tracking for connection mode
  const handleCanvasMouseMove = useCallback((event: React.MouseEvent) => {
    if (connectionState.isConnecting) {
      const canvasContent = canvasRef.current?.querySelector('.canvas__content');
      if (canvasContent) {
        const rect = canvasContent.getBoundingClientRect();
        const cursorPosition = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
        
        // Debug: Log cursor position updates less frequently
        if (Math.random() < 0.1) { // Only log 10% of the time to avoid spam
          console.log('🐭 Cursor moved during connection:', cursorPosition);
        }
        
        setConnectionState(prev => ({
          ...prev,
          cursorPosition,
        }));
      }
    }
  }, [connectionState.isConnecting]);
  
  // Canvas click handler for connection completion or cancellation
  const handleCanvasClick = useCallback((event: React.MouseEvent) => {
    if (connectionState.isConnecting) {
      console.log('🖥️ Canvas clicked during connection mode:', {
        isConnecting: connectionState.isConnecting,
        targetBlockId: connectionState.targetBlockId,
        sourceBlockId: connectionState.sourceBlockId
      });
      
      if (connectionState.targetBlockId) {
        console.log('🚀 Completing connection...');
        // Complete connection
        handleCompleteConnection();
      } else {
        console.log('❌ Canceling connection - clicked empty canvas');
        // Cancel connection (clicked empty canvas)
        handleCancelConnection();
      }
      event.stopPropagation();
    }
  }, [connectionState.isConnecting, connectionState.targetBlockId, handleCompleteConnection, handleCancelConnection]);
  
  // Keyboard shortcuts for zoom controls and connection mode
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if no input/textarea is focused
      const activeElement = document.activeElement;
      const isInputFocused = activeElement?.tagName === 'INPUT' || 
                           activeElement?.tagName === 'TEXTAREA' ||
                           activeElement?.contentEditable === 'true';
                           
      if (isInputFocused) return;
      
      // Handle ESC to cancel connection
      if (e.key === 'Escape' && connectionState.isConnecting) {
        e.preventDefault();
        handleCancelConnection();
        return;
      }
      
      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault();
          handleZoomIn();
          break;
        case '-':
        case '_':
          e.preventDefault();
          handleZoomOut();
          break;
        case '0':
          e.preventDefault();
          handleZoomReset();
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleZoomReset, connectionState.isConnecting, handleCancelConnection]);

  const handleBreadcrumbNavigation = useCallback((level: string, path: string[]) => {
    const transition = createDefaultTransition('drill-up');
    navigateToBreadcrumb(level, path, transition);
  }, [navigateToBreadcrumb]);

  return (
    <div className={`canvas-workspace ${className}`}>
      {/* Breadcrumb navigation */}
      <CanvasBreadcrumbs 
        breadcrumbs={state.breadcrumbs}
        onNavigate={handleBreadcrumbNavigation}
      />
      
      {/* Canvas header with controls */}
      <div className="canvas-workspace__header">
        <h1 className="canvas-workspace__title">
          {state.currentLevel === 'sources' ? 'Data Sources Canvas' : `Tables in ${state.sourceName}`}
        </h1>
        <div className="canvas-workspace__controls">
          <button 
            className="canvas-workspace__control-btn"
            onClick={resetViewport}
            title="Reset viewport (0)"
          >
            Reset View
          </button>
          {connectionState.isConnecting && (
            <button 
              className="canvas-workspace__control-btn"
              style={{ background: 'rgba(239, 68, 68, 0.8)' }}
              onClick={handleCancelConnection}
              title="Cancel connection creation"
            >
              Cancel Connection
            </button>
          )}
          <button 
            className="canvas-workspace__control-btn"
            onClick={() => setShowHelpModal(!showHelpModal)}
            title="Toggle help"
          >
            Help
          </button>
          <span className="canvas-workspace__viewport-info">
            Zoom: {Math.round(viewport.zoom * 100)}%
          </span>
          {process.env.NODE_ENV === 'development' && (
            <span className="canvas-workspace__debug-info" style={{ 
              fontSize: '0.7rem', 
              color: 'rgba(255, 255, 255, 0.6)',
              marginLeft: '1rem' 
            }}>
              Connection: {connectionState.isConnecting ? 'ON' : 'OFF'}
            </span>
          )}
        </div>
      </div>

      {/* Main canvas area */}
      <div ref={canvasRef} className={`canvas-workspace__content ${
        state.isTransitioning ? 'canvas-workspace__content--transitioning' : ''
      } ${
        state.activeTransition?.type === 'drill-down' ? 'canvas-workspace__content--drill-down' : ''
      } ${
        state.activeTransition?.type === 'drill-up' ? 'canvas-workspace__content--drill-up' : ''
      } ${
        connectionState.isConnecting ? 'canvas-workspace__content--connecting' : ''
      } ${
        connectionState.isConnecting && connectionState.targetBlockId ? 'canvas-workspace__content--has-target' : ''
      }`}>
        <Canvas
          viewport={viewport}
          onViewportChange={handleViewportChange}
          gridSize={20}
          minZoom={0.1}
          maxZoom={3.0}
        >
          <div 
            style={{ width: '100%', height: '100%', position: 'absolute' }}
            onMouseMove={handleCanvasMouseMove}
            onClick={handleCanvasClick}
          >
            {/* Render different content based on current level */}
            {state.currentLevel === 'sources' ? (
              <>
                <DemoCanvasBlocks 
                  onDrillDown={drillDown}
                  isConnectionMode={connectionState.isConnecting}
                  connectionSourceId={connectionState.sourceBlockId}
                  connectionTargetId={connectionState.targetBlockId}
                  onConnectionStart={handleConnectionStart}
                  onConnectionTarget={handleConnectionTarget}
                  onConnectionTargetLeave={handleConnectionTargetLeave}
                  onRelationshipInteraction={handleRelationshipInteraction}
                />
                {/* Dynamic connection line */}
                <DynamicConnectionLine connectionState={connectionState} />
              </>
            ) : (
            state.sourceKind ? (
              <DemoTableBlocks 
                sourceKind={state.sourceKind as any} 
                sourceName={state.sourceName || 'Unknown'}
              />
            ) : (
              <div style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                color: '#666',
                textAlign: 'center'
              }}>
                No tables to display
              </div>
            )
          )}
          </div>
        </Canvas>
        
        {/* Floating UI overlay */}
        <CanvasFloatingUI>
          {/* Plus button - bottom right */}
          <FloatingElement position="bottom-right">
            <FloatingPlusButton 
              onClick={handleAddDataSource}
              tooltip="Add new data source"
            />
          </FloatingElement>
          
          {/* Zoom controls - bottom left */}
          <FloatingElement position="bottom-left">
            <ZoomControls
              zoom={viewport.zoom}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onZoomReset={handleZoomReset}
            />
          </FloatingElement>
          
          {/* Mini-map - top right */}
          <FloatingElement position="top-right">
            <CanvasMiniMap
              viewport={viewport}
              onViewportChange={setViewport}
            />
          </FloatingElement>
        </CanvasFloatingUI>
      </div>

      {/* Collapsible Help Modal */}
      {showHelpModal && (
        <div className="help-modal-overlay" onClick={() => setShowHelpModal(false)}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="help-modal__header">
              <h3>Canvas Controls</h3>
              <button 
                className="help-modal__close"
                onClick={() => setShowHelpModal(false)}
                aria-label="Close help"
              >
                ×
              </button>
            </div>
            <div className="help-modal__body">
              <ul>
                <li><strong>Mouse wheel:</strong> Zoom in/out</li>
                <li><strong>Ctrl/Cmd + Drag:</strong> Pan canvas</li>
                <li><strong>+ / -:</strong> Zoom with keyboard</li>
                <li><strong>0:</strong> Reset zoom to 100%</li>
                <li><strong>Hover near block edge:</strong> Show connection dot</li>
                <li><strong>Click connection dot:</strong> Start creating connection</li>
                <li><strong>While connecting:</strong> Bezier curve follows cursor</li>
                <li><strong>Click target block:</strong> Open relationship modal</li>
                <li><strong>ESC:</strong> Cancel connection creation</li>
                <li><strong>Double-click block:</strong> Drill down to tables</li>
                <li><strong>Breadcrumb / Back:</strong> Navigate up levels</li>
              </ul>
              <p className="help-note">
                {state.currentLevel === 'sources' 
                  ? 'Double-click any data source block to view its tables and collections.'
                  : 'Use the back button or breadcrumbs to return to the data sources view.'
                }
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Connection Configuration Modal */}
      <ConnectionModal 
        isOpen={connectionModal.isOpen}
        onClose={() => {
          setConnectionModal({ isOpen: false });
          setPendingConnection(null);
          // Also ensure connection state is fully reset when modal closes
          if (connectionState.isConnecting) {
            handleCancelConnection();
          }
        }}
        sourceBlock={connectionModal.sourceBlock}
        targetBlock={connectionModal.targetBlock}
      />
    </div>
  );
}

// Function to create demo relationships between data sources
function createDemoRelationships(blockPositions: Record<string, { x: number; y: number }>): VisualRelationship[] {
  const relationships: VisualRelationship[] = [];
  
  // Relationship 1: PostgreSQL to MongoDB (cross-source)
  const pgPos = blockPositions['demo-pg-1'] || { x: -100, y: -60 };
  const mongoPos = blockPositions['demo-mongo-1'] || { x: 150, y: -60 };
  
  const pgToMongo: VisualRelationship = {
    id: 'pg-to-mongo-1',
    sourceBlockId: 'demo-pg-1',
    targetBlockId: 'demo-mongo-1',
    sourceKind: 'postgres',
    targetKind: 'mongo',
    type: 'cross-source',
    sourcePoint: {
      id: 'pg-right-1',
      blockId: 'demo-pg-1',
      position: getConnectionPointPosition(
        pgPos,
        { width: 200, height: 120 },
        'right'
      ),
      anchor: 'right'
    },
    targetPoint: {
      id: 'mongo-left-1',
      blockId: 'demo-mongo-1',
      position: getConnectionPointPosition(
        mongoPos,
        { width: 200, height: 120 },
        'left'
      ),
      anchor: 'left'
    },
    style: getStyleForRelationship('cross-source', 'postgres'),
    metadata: {
      label: 'User Sync',
      description: 'User data synchronization between PostgreSQL and MongoDB',
      cardinality: '1:N'
    }
  };
  
  // Relationship 2: MongoDB to DuckDB (cross-source)
  const duckPos = blockPositions['demo-duckdb-1'] || { x: 25, y: 100 };
  
  const mongoToDuck: VisualRelationship = {
    id: 'mongo-to-duck-1',
    sourceBlockId: 'demo-mongo-1',
    targetBlockId: 'demo-duckdb-1',
    sourceKind: 'mongo',
    targetKind: 'duckdb',
    type: 'cross-source',
    sourcePoint: {
      id: 'mongo-bottom-1',
      blockId: 'demo-mongo-1',
      position: getConnectionPointPosition(
        mongoPos,
        { width: 200, height: 120 },
        'bottom'
      ),
      anchor: 'bottom'
    },
    targetPoint: {
      id: 'duck-top-1',
      blockId: 'demo-duckdb-1',
      position: getConnectionPointPosition(
        duckPos,
        { width: 200, height: 120 },
        'top'
      ),
      anchor: 'top'
    },
    style: getStyleForRelationship('cross-source', 'mongo'),
    metadata: {
      label: 'Analytics ETL',
      description: 'Extract analytics data from MongoDB to DuckDB warehouse',
      cardinality: 'N:1'
    }
  };
  
  // Relationship 3: PostgreSQL to MySQL (cross-source, with error styling)
  const mysqlPos = blockPositions['demo-mysql-1'] || { x: -150, y: 120 };
  
  const pgToMysql: VisualRelationship = {
    id: 'pg-to-mysql-1',
    sourceBlockId: 'demo-pg-1',
    targetBlockId: 'demo-mysql-1',
    sourceKind: 'postgres',
    targetKind: 'mysql',
    type: 'cross-source',
    sourcePoint: {
      id: 'pg-left-1',
      blockId: 'demo-pg-1',
      position: getConnectionPointPosition(
        pgPos,
        { width: 200, height: 120 },
        'left'
      ),
      anchor: 'left'
    },
    targetPoint: {
      id: 'mysql-right-1',
      blockId: 'demo-mysql-1',
      position: getConnectionPointPosition(
        mysqlPos,
        { width: 200, height: 120 },
        'right'
      ),
      anchor: 'right'
    },
    style: {
      ...getStyleForRelationship('cross-source', 'postgres'),
      strokeColor: '#f87171', // Error red
      strokeDasharray: '8,4',
      opacity: 0.7
    },
    metadata: {
      label: 'Legacy Sync (Error)',
      description: 'Legacy data sync - currently experiencing connection issues',
      cardinality: '1:1'
    }
  };
  
  relationships.push(pgToMongo, mongoToDuck, pgToMysql);
  return relationships;
}

// Demo canvas blocks using CanvasBlock component
interface DemoCanvasBlocksProps {
  onDrillDown: (context: DrillDownContext) => void;
  isConnectionMode?: boolean;
  connectionSourceId?: string | null;
  connectionTargetId?: string | null;
  onConnectionStart?: (blockId: string, position: CanvasPosition) => void;
  onConnectionTarget?: (blockId: string, position: CanvasPosition) => void;
  onConnectionTargetLeave?: () => void;
  onRelationshipInteraction: (event: RelationshipInteractionEvent) => void;
}

// Demo data sources (moved to module level for access in callbacks)
const demoDataSources = [
    {
      id: 'demo-pg-1',
      kind: 'postgres' as const,
      name: 'Production DB',
      database: 'ecommerce_prod',
      status: 'connected' as const,
      tableCount: 23,
    },
    {
      id: 'demo-mongo-1',
      kind: 'mongo' as const,
      name: 'User Analytics',
      database: 'analytics',
      status: 'connected' as const,
      tableCount: 7,
    },
    {
      id: 'demo-duckdb-1',
      kind: 'duckdb' as const,
      name: 'Data Warehouse',
      database: 'warehouse.duckdb',
      status: 'connected' as const,
      tableCount: 15,
    },
    {
      id: 'demo-mysql-1',
      kind: 'mysql' as const,
      name: 'Legacy System',
      database: 'legacy_crm',
      status: 'error' as const,
      error: 'Connection timeout',
    },
  ];

function DemoCanvasBlocks({ 
  onDrillDown,
  isConnectionMode = false,
  connectionSourceId = null,
  connectionTargetId = null,
  onConnectionStart,
  onConnectionTarget,
  onConnectionTargetLeave,
  onRelationshipInteraction
}: DemoCanvasBlocksProps) {
  const [blockPositions, setBlockPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    // Initial positions
    return {
      'demo-pg-1': { x: -100, y: -60 },
      'demo-mongo-1': { x: 150, y: -60 },
      'demo-duckdb-1': { x: 25, y: 100 },
      'demo-mysql-1': { x: -150, y: 120 },
    };
  });
  
  const handlePositionChange = useCallback((id: string, position: CanvasPosition) => {
    setBlockPositions(prev => ({
      ...prev,
      [id]: position
    }));
    // Block position updated
  }, []);

  return (
    <>
      {demoDataSources.map((source) => {
        const isConnectionTarget = connectionTargetId === source.id;
        const isSourceBlock = connectionSourceId === source.id;
        const position = blockPositions[source.id] || { x: 0, y: 0 };
        
        return (
          <CanvasBlock
            key={source.id}
            id={source.id}
            position={position}
            size={{ width: 200, height: 120 }}
            dataSource={{
              id: source.id,
              name: source.name,
              kind: source.kind,
              connectionStatus: source.status === 'connected' ? 'connected' : 
                              source.status === 'error' ? 'error' : 'unknown',
              crawlStatus: source.status === 'crawling' ? 'crawling' : 
                          source.status === 'connected' ? 'crawled' : 'not_crawled',
              databaseName: source.database,
              tableCount: source.tableCount,
              lastError: source.error,
            }}
            selected={false}
            isConnectionMode={isConnectionMode}
            isConnectionTarget={isConnectionTarget}
            onPositionChange={handlePositionChange}
            onClick={(id) => {
              console.log(`Block ${id} clicked`);
            }}
            onDoubleClick={(id) => {
              console.log(`Block ${id} double-clicked - drilling down`);
              const sourceData = demoDataSources.find(s => s.id === id);
              if (sourceData && sourceData.kind && sourceData.name && sourceData.database) {
                const drillContext: DrillDownContext = {
                  sourceId: sourceData.id,
                  sourceName: sourceData.name,
                  sourceKind: sourceData.kind,
                  database: sourceData.database,
                  tables: generateDemoTables(sourceData.kind, sourceData.database),
                };
                onDrillDown(drillContext);
              }
            }}
            onContextMenu={(id) => {
              console.log(`Block ${id} right-clicked - show context menu`);
            }}
            onConnectionStart={onConnectionStart}
            onConnectionTarget={onConnectionTarget}
            onConnectionTargetLeave={onConnectionTargetLeave}
          />
        );
      })}

      {/* Render relationships between data sources */}
      <RelationshipRenderer 
        relationships={createDemoRelationships(blockPositions)}
        onRelationshipInteraction={onRelationshipInteraction}
      />
    </>
  );
}

// Demo table blocks for drill-down view
function DemoTableBlocks({ sourceKind, sourceName }: { sourceKind: 'postgres' | 'mysql' | 'mongo' | 'duckdb'; sourceName: string }) {
  const demoTables = generateDemoTables(sourceKind, 'demo_db');
  const [tablePositions, setTablePositions] = useState(() => {
    // Auto-layout tables in a grid
    const positions: Record<string, { x: number; y: number }> = {};
    const cols = 3;
    demoTables.forEach((table, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      positions[table.id] = {
        x: col * 220 - 200,
        y: row * 140 - 60,
      };
    });
    return positions;
  });

  const handleTablePositionChange = useCallback((tableId: string, newX: number, newY: number) => {
    setTablePositions(prev => ({
      ...prev,
      [tableId]: { x: newX, y: newY }
    }));
  }, []);

  return (
    <>
      {demoTables.map((table) => {
        const position = tablePositions[table.id] || { x: 0, y: 0 };
        return (
          <TableBlock
            key={table.id}
            table={table}
            x={position.x}
            y={position.y}
            width={180}
            height={100}
            sourceKind={sourceKind}
            selected={false}
            onPositionChange={handleTablePositionChange}
            onClick={(tableId) => {
              console.log(`Table ${tableId} clicked`);
            }}
            onDoubleClick={(tableId) => {
              console.log(`Table ${tableId} double-clicked - future: show columns`);
            }}
            onContextMenu={(tableId, event) => {
              console.log(`Table ${tableId} right-clicked`);
            }}
          />
        );
      })}
    </>
  );
}

// Helper function to generate demo tables based on source type
function generateDemoTables(sourceKind: 'postgres' | 'mysql' | 'mongo' | 'duckdb', database: string) {
  const baseId = `${sourceKind}_${database}`;
  
  switch (sourceKind) {
    case 'postgres':
      return [
        {
          id: `${baseId}_users`,
          name: 'users',
          type: 'table' as const,
          rowCount: 15420,
          schema: 'public',
          description: 'User account information'
        },
        {
          id: `${baseId}_orders`,
          name: 'orders', 
          type: 'table' as const,
          rowCount: 89320,
          schema: 'public',
          description: 'Customer orders'
        },
        {
          id: `${baseId}_products`,
          name: 'products',
          type: 'table' as const,
          rowCount: 2340,
          schema: 'public'
        },
        {
          id: `${baseId}_order_items`,
          name: 'order_items',
          type: 'table' as const,
          rowCount: 234560,
          schema: 'public'
        },
        {
          id: `${baseId}_user_activity_view`,
          name: 'user_activity_view',
          type: 'view' as const,
          rowCount: 15420,
          schema: 'analytics',
          description: 'Aggregated user activity metrics'
        }
      ];
      
    case 'mysql':
      return [
        {
          id: `${baseId}_customers`,
          name: 'customers',
          type: 'table' as const,
          rowCount: 5680,
          schema: 'crm'
        },
        {
          id: `${baseId}_contacts`,
          name: 'contacts',
          type: 'table' as const,
          rowCount: 12340,
          schema: 'crm'
        },
        {
          id: `${baseId}_leads`,
          name: 'leads',
          type: 'table' as const,
          rowCount: 3210,
          schema: 'crm'
        }
      ];
      
    case 'mongo':
      return [
        {
          id: `${baseId}_events`,
          name: 'events',
          type: 'collection' as const,
          rowCount: 1200000,
          description: 'User interaction events'
        },
        {
          id: `${baseId}_sessions`,
          name: 'sessions',
          type: 'collection' as const,
          rowCount: 450000
        },
        {
          id: `${baseId}_users_profile`,
          name: 'users_profile',
          type: 'collection' as const,
          rowCount: 89000,
          description: 'Extended user profile data'
        }
      ];
      
    case 'duckdb':
      return [
        {
          id: `${baseId}_sales_data`,
          name: 'sales_data',
          type: 'table' as const,
          rowCount: 500000,
          description: 'Historical sales records'
        },
        {
          id: `${baseId}_customer_metrics`,
          name: 'customer_metrics',
          type: 'table' as const,
          rowCount: 25000
        },
        {
          id: `${baseId}_financial_summary`,
          name: 'financial_summary',
          type: 'view' as const,
          rowCount: 12,
          description: 'Monthly financial aggregates'
        }
      ];
      
    default:
      return [];
  }
}
