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
  const [userRelationships, setUserRelationships] = useState<VisualRelationship[]>([]);
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
  
  // Handle saving a relationship definition from the modal
  const handleSaveRelationship = useCallback((relationship: {
    sourceTable: string;
    sourceColumn: string;
    targetTable: string;
    targetColumn: string;
  }) => {
    console.log('💾 Saving relationship:', relationship);
    
    if (!pendingConnection || !connectionModal.sourceBlock || !connectionModal.targetBlock) {
      console.error('Missing required data for relationship creation');
      return;
    }
    
    // Create a new visual relationship from the form data
    const newRelationship: VisualRelationship = {
      id: `user-rel-${Date.now()}`,
      sourceBlockId: connectionModal.sourceBlock.id,
      targetBlockId: connectionModal.targetBlock.id,
      sourceKind: connectionModal.sourceBlock.kind as any,
      targetKind: connectionModal.targetBlock.kind as any,
      type: 'cross-source',
      sourcePoint: {
        id: `${connectionModal.sourceBlock.id}-connection-point`,
        blockId: connectionModal.sourceBlock.id,
        position: pendingConnection.sourcePosition,
        anchor: determineAnchorFromPosition(pendingConnection.sourcePosition, pendingConnection.targetPosition)
      },
      targetPoint: {
        id: `${connectionModal.targetBlock.id}-connection-point`,
        blockId: connectionModal.targetBlock.id,
        position: pendingConnection.targetPosition,
        anchor: determineAnchorFromPosition(pendingConnection.targetPosition, pendingConnection.sourcePosition)
      },
      style: {
        strokeColor: 'rgba(34, 197, 94, 0.8)', // Green for user-created
        hoverColor: 'rgba(34, 197, 94, 1)',
        selectedColor: 'rgba(34, 197, 94, 1)',
        strokeWidth: 2,
        strokeDasharray: '5,5', // Dashed to distinguish from demo relationships
        opacity: 0.9,
        curve: {
          curvature: 0.3,
          controlPointOffset: 80
        }
      },
      metadata: {
        label: `${relationship.sourceTable}.${relationship.sourceColumn} → ${relationship.targetTable}.${relationship.targetColumn}`,
        description: `User-defined relationship between ${connectionModal.sourceBlock.name} and ${connectionModal.targetBlock.name}`,
        cardinality: '1:1' // Default, could be configurable later
      }
    };
    
    // Add the new relationship to state
    setUserRelationships(prev => [...prev, newRelationship]);
    
    // For demo purposes, show success in console
    console.log('✅ Relationship created successfully between:', {
      source: `${connectionModal.sourceBlock?.name}.${relationship.sourceTable}.${relationship.sourceColumn}`,
      target: `${connectionModal.targetBlock?.name}.${relationship.targetTable}.${relationship.targetColumn}`
    });
    
    // TODO: This is where we would persist the relationship to the backend
    // In the future, this would call an IPC method like:
    // await window.semantiqa?.api.invoke('relationships:create', {
    //   sourceBlockId: connectionModal.sourceBlock?.id,
    //   targetBlockId: connectionModal.targetBlock?.id,
    //   sourceTable: relationship.sourceTable,
    //   sourceColumn: relationship.sourceColumn,
    //   targetTable: relationship.targetTable,
    //   targetColumn: relationship.targetColumn,
    // });
    
    // Close modal and clean up state
    setConnectionModal({ isOpen: false });
    setPendingConnection(null);
  }, [connectionModal.sourceBlock, connectionModal.targetBlock, pendingConnection]);
  
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
                {/* Empty state for data sources - will be populated by actual data */}
                <div style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  color: '#999',
                  textAlign: 'center',
                  fontSize: '1.1rem'
                }}>
                  <div>No data sources configured</div>
                  <div style={{ fontSize: '0.9rem', marginTop: '0.5rem', opacity: 0.7 }}>Click the + button to add your first data source</div>
                </div>
                {/* Dynamic connection line */}
                <DynamicConnectionLine connectionState={connectionState} />
              </>
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
        onSaveRelationship={handleSaveRelationship}
      />
    </div>
  );
}

// Helper function to determine anchor based on relative positions
function determineAnchorFromPosition(
  sourcePos: CanvasPosition, 
  targetPos: CanvasPosition
): 'top' | 'right' | 'bottom' | 'left' {
  const dx = targetPos.x - sourcePos.x;
  const dy = targetPos.y - sourcePos.y;
  
  // Determine which direction is stronger
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  } else {
    return dy > 0 ? 'bottom' : 'top';
  }
}
