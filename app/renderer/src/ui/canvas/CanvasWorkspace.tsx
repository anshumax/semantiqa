import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  BackgroundVariant,
  Panel,
  NodeTypes,
  NodeChange,
  EdgeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { DataSourceNode, DataSourceNodeData } from './DataSourceNode';
import { CanvasBreadcrumbs } from './CanvasBreadcrumbs';
import { CanvasNavigationProvider, useCanvasNavigation } from './CanvasNavigationContext';
import { FloatingPlusButton } from './FloatingPlusButton';
import { ConnectionModal } from './ConnectionModal';
import { CanvasConnectWizard } from './CanvasConnectWizard';
import { useCanvasPersistence } from './useCanvasPersistence';
import { createDefaultTransition, TableInfo } from './navigationTypes';
import type { CanvasTableBlock } from '@semantiqa/contracts';
import { DataSourceContextMenu } from './DataSourceContextMenu';
import { RelationshipContextMenu } from './RelationshipContextMenu';
import { CanvasLoadingScreen } from './CanvasLoadingScreen';
import './CanvasWorkspace.css';

// Custom node types for ReactFlow
const nodeTypes: NodeTypes = {
  dataSource: (props: any) => <DataSourceNode {...props} onRetryCrawl={props.data.onRetryCrawl} onContextMenu={props.data.onContextMenu} />,
};

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
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showConnectWizard, setShowConnectWizard] = useState(false);
  
  // Load canvas data from persistence layer with auto-save
  const { 
    data: canvasData, 
    refresh: refreshCanvas,
    updateCanvas,
    updateBlockPosition,
    createBlock,
    deleteBlock,
    createRelationship,
    deleteRelationship,
    saveNow,
    hasUnsavedChanges,
    isSaving,
    status
  } = useCanvasPersistence();

  // Initial load state
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState<DataSourceNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Custom handlers that integrate with persistence layer
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);
    
    // Handle position changes for auto-save
    changes.forEach(change => {
      if (change.type === 'position' && change.position) {
        updateBlockPosition(change.id, change.position);
      }
    });
  }, [onNodesChange, updateBlockPosition]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChange(changes);
    
    // Handle edge deletions for auto-save
    changes.forEach(change => {
      if (change.type === 'remove') {
        const edgeId = change.id;
        
        // Remove from persistence layer (this will trigger auto-save)
        deleteRelationship(edgeId);
      }
    });
  }, [onEdgesChange, deleteRelationship]);
  
  // Tables data for tables view
  const [tablesData, setTablesData] = useState<TableInfo[]>([]);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    sourceId: string;
    blockId: string;
  }>({
    visible: false,
    x: 0,
    y: 0,
    sourceId: '',
    blockId: '',
  });

  // Relationship context menu state
  const [relationshipContextMenu, setRelationshipContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    relationshipId: string;
  }>({
    visible: false,
    x: 0,
    y: 0,
    relationshipId: '',
  });
  
  // Connection modal state
  const [connectionModal, setConnectionModal] = useState<{
    isOpen: boolean;
    sourceBlock?: { id: string; name: string; kind: string };
    targetBlock?: { id: string; name: string; kind: string };
    sourceTable?: { id: string; name: string; sourceId: string };
    targetTable?: { id: string; name: string; sourceId: string };
    connection?: Connection;
  }>({ isOpen: false });
  
  const { state, drillDown, navigateToBreadcrumb } = useCanvasNavigation();

  // Handler functions
  const handleRetryCrawl = useCallback(async (sourceId: string) => {
    try {
      await window.semantiqa?.api.invoke('sources:retry-crawl', { sourceId });
      // Refresh canvas to show updated status
      await refreshCanvas();
    } catch (error) {
      console.error('Failed to retry crawl:', error);
    }
  }, [refreshCanvas]);

  const handleContextMenu = useCallback((event: React.MouseEvent, nodeId: string, sourceId: string) => {
    event.preventDefault();
    event.stopPropagation();
    
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      sourceId: sourceId,
      blockId: nodeId,
    });
    
    // Close relationship context menu if open
    setRelationshipContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  const handleContextMenuRetry = useCallback(() => {
    if (contextMenu.sourceId) {
      handleRetryCrawl(contextMenu.sourceId);
    }
    handleCloseContextMenu();
  }, [contextMenu.sourceId, handleRetryCrawl, handleCloseContextMenu]);

  // Handle edge context menu (right-click)
  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    event.stopPropagation();
    
    setRelationshipContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      relationshipId: edge.id,
    });
    
    // Close data source context menu if open
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  // Handle relationship deletion from context menu
  const handleDeleteRelationship = useCallback((relationshipId: string) => {
    console.log('Deleting relationship:', relationshipId);
    deleteRelationship(relationshipId);
    refreshCanvas();  // Refresh to update UI
  }, [deleteRelationship, refreshCanvas]);

  // Handle block deletion from context menu
  const handleDeleteBlock = useCallback((blockId: string, sourceId: string) => {
    console.log('Deleting block:', { blockId, sourceId });
    deleteBlock(blockId, sourceId);
    refreshCanvas();  // Refresh to update UI
  }, [deleteBlock, refreshCanvas]);

  // Close relationship context menu
  const handleCloseRelationshipContextMenu = useCallback(() => {
    setRelationshipContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  // Handle canvas clicks to close context menus
  const onPaneClick = useCallback(() => {
    setContextMenu(prev => ({ ...prev, visible: false }));
    setRelationshipContextMenu(prev => ({ ...prev, visible: false }));
  }, []);


  // Load tables data when in tables view
  useEffect(() => {
    if (state.currentLevel === 'tables' && state.sourceId) {
      // Load actual tables from metadata service
      const loadTables = async () => {
        try {
          const response = await window.semantiqa?.api.invoke('tables:list', { sourceId: state.sourceId });
          if ('tables' in response) {
            setTablesData(response.tables);
          } else {
            console.error('Failed to load tables:', response);
            setTablesData([]);
          }
        } catch (error) {
          console.error('Error loading tables:', error);
          setTablesData([]);
        }
      };
      
      loadTables();
    } else {
      setTablesData([]);
    }
  }, [state.currentLevel, state.sourceId]);

  // Convert canvas blocks to ReactFlow nodes for sources view
  useEffect(() => {
    if (state.currentLevel === 'sources') {
      // Show data source nodes
      if (!canvasData?.blocks) return;

      const flowNodes = canvasData.blocks.map((block) => {
        return {
          id: block.id,
          type: 'dataSource',
          position: { x: block.position.x, y: block.position.y },
          data: {
            id: block.sourceId,
            name: block.source?.name || 'Unknown',
            kind: (block.source?.kind || 'postgres') as DataSourceNodeData['kind'],
            connectionStatus: block.source?.connectionStatus || 'unknown',
            crawlStatus: block.source?.crawlStatus || 'not_crawled',
            lastError: block.source?.lastError,
            onRetryCrawl: handleRetryCrawl,
            onContextMenu: (event: React.MouseEvent) => handleContextMenu(event, block.id, block.sourceId),
          },
        };
      });

      setNodes(flowNodes);
    }
  }, [canvasData?.blocks, state.currentLevel, setNodes, handleRetryCrawl, handleContextMenu]);

  // Track which tables have been initialized to avoid infinite loop
  const initializedTablesRef = useRef<Set<string>>(new Set());

  // Convert table data to ReactFlow nodes for tables view (separate effect to avoid recreation)
  useEffect(() => {
    if (state.currentLevel === 'tables') {
      if (tablesData.length > 0) {
        // Get saved table block positions from canvas data
        const savedTableBlocks = canvasData?.tableBlocks || [];
        const tableBlocksMap = new Map(savedTableBlocks.map(tb => [tb.tableId, tb]));
        
        // Collect new table blocks that need to be created (outside the map loop)
        const newTableBlocksToCreate: Array<Omit<CanvasTableBlock, 'createdAt' | 'updatedAt'>> = [];
        
        // Show table nodes
        const flowNodes = tablesData.map((table, index) => {
          // Check if we have a saved position for this table
          const savedBlock = tableBlocksMap.get(table.id);
          const position = savedBlock 
            ? { x: savedBlock.position.x, y: savedBlock.position.y }
            : { 
                x: 100 + (index % 3) * 250, 
                y: 100 + Math.floor(index / 3) * 150 
              };
          
          // Queue table block creation if it doesn't exist AND hasn't been initialized yet
          if (!savedBlock && state.sourceId && !initializedTablesRef.current.has(table.id)) {
            initializedTablesRef.current.add(table.id);
            newTableBlocksToCreate.push({
              id: `table-${table.id}`,
              canvasId: 'default',
              sourceId: state.sourceId,
              tableId: table.id,
              position,
              size: { width: 200, height: 150 },
              zIndex: 0,
              colorTheme: 'auto' as const,
              isSelected: false,
              isMinimized: false,
            });
          }

          return {
            id: `table-${table.id}`,
            type: 'dataSource', // We'll use the same node type for now
            position,
            draggable: true, // Enable dragging for table nodes
            data: {
              id: table.id,
              name: table.name,
              kind: (state.sourceKind || 'postgres') as DataSourceNodeData['kind'],
              connectionStatus: 'connected' as const,
              crawlStatus: 'crawled' as const,
              tableCount: table.rowCount,
              onContextMenu: (event: React.MouseEvent) => handleContextMenu(event, `table-${table.id}`, table.sourceId),
            },
          };
        });

        setNodes(flowNodes);
        
        // Create new table blocks in a single batch (only happens once per table)
        if (newTableBlocksToCreate.length > 0) {
          console.log('📦 Creating initial table blocks:', newTableBlocksToCreate.length);
          updateCanvas({ tableBlocks: newTableBlocksToCreate });
        }
      } else {
        // Clear nodes when no table data
        setNodes([]);
      }
    } else {
      // Clear the initialized tables when leaving table view
      initializedTablesRef.current.clear();
    }
  }, [tablesData, state.currentLevel, state.sourceKind, state.sourceId, setNodes, updateCanvas, handleContextMenu]);

  // Convert canvas relationships to ReactFlow edges
  useEffect(() => {
    console.log('🔗 Relationship conversion effect triggered:', {
      hasCanvasData: !!canvasData,
      hasRelationships: !!canvasData?.relationships,
      relationshipCount: canvasData?.relationships?.length || 0,
      currentLevel: state.currentLevel,
      sourceId: state.sourceId
    });

    if (!canvasData?.relationships) {
      console.log('🔗 No relationships to convert, clearing edges');
      setEdges([]);
      return;
    }

    // Filter relationships based on current view level
    const filteredRelationships = canvasData.relationships.filter(rel => {
      if (state.currentLevel === 'sources') {
        // Show only inter-source relationships (source and target are different data sources)
        const isInterSource = rel.sourceId !== rel.targetId;
        return isInterSource;
      } else if (state.currentLevel === 'tables' && state.sourceId) {
        // Show only intra-source relationships for the current source
        const isIntraSource = rel.sourceId === state.sourceId && rel.targetId === state.sourceId;
        return isIntraSource;
      }
      return false;
    });

    console.log('🔗 Converting relationships to edges:', {
      currentLevel: state.currentLevel,
      totalRelationships: canvasData.relationships.length,
      filteredRelationships: filteredRelationships.length,
      relationships: filteredRelationships.map(r => ({
        id: r.id,
        sourceTableId: r.sourceTableId,
        targetTableId: r.targetTableId,
        sourceId: r.sourceId,
        targetId: r.targetId
      }))
    });

    const flowEdges: Edge[] = filteredRelationships.map((rel) => {
      // For table relationships, we need to map table IDs to ReactFlow node IDs
      const sourceNodeId = state.currentLevel === 'tables' 
        ? `table-${rel.sourceTableId}` 
        : rel.sourceId;
      const targetNodeId = state.currentLevel === 'tables' 
        ? `table-${rel.targetTableId}` 
        : rel.targetId;

      return {
        id: rel.id,
        source: sourceNodeId,
        target: targetNodeId,
        type: 'smoothstep',
        animated: false,
        style: {
          stroke: rel.lineColor || '#22c55e',
          strokeWidth: rel.lineWidth || 2,
          strokeDasharray: rel.visualStyle === 'dashed' ? '5,5' : undefined,
          cursor: 'pointer',
        },
        className: 'canvas-edge',
        label: `${rel.sourceTableId?.split('_').pop() || 'source'} → ${rel.targetTableId?.split('_').pop() || 'target'}`,
      };
    });

    setEdges(flowEdges);
  }, [canvasData?.relationships, setEdges, state.currentLevel, state.sourceId]);

  // Handle new connections
  const onConnect = useCallback((connection: Connection) => {
    console.log('🔗 Connection created:', connection);
    
    // Find source and target nodes
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);
    
    if (!sourceNode || !targetNode) {
      console.error('Source or target node not found');
      return;
    }

    // Check if we're in tables view and these are table nodes
    if (state.currentLevel === 'tables' && sourceNode.id.startsWith('table-') && targetNode.id.startsWith('table-')) {
      // This is a table-to-table connection
      const sourceTableId = sourceNode.id.replace('table-', '');
      const targetTableId = targetNode.id.replace('table-', '');
      
      const sourceTable = tablesData.find(t => t.id === sourceTableId);
      const targetTable = tablesData.find(t => t.id === targetTableId);
      
      if (sourceTable && targetTable) {
        setConnectionModal({
          isOpen: true,
          sourceTable: {
            id: sourceTable.id,
            name: sourceTable.name,
            sourceId: state.sourceId || '',
          },
          targetTable: {
            id: targetTable.id,
            name: targetTable.name,
            sourceId: state.sourceId || '',
          },
          connection,
        });
        return;
      }
    }

    // Default data source to data source connection
    setConnectionModal({
      isOpen: true,
      sourceBlock: {
        id: sourceNode.id,
        name: sourceNode.data.name,
        kind: sourceNode.data.kind,
      },
      targetBlock: {
        id: targetNode.id,
        name: targetNode.data.name,
        kind: targetNode.data.kind,
      },
      connection,
    });
  }, [nodes, state.currentLevel, state.sourceId, tablesData]);

  // Handle saving relationship from modal
  const handleSaveRelationship = useCallback((relationship: {
    sourceTable: string;
    sourceColumn: string;
    targetTable: string;
    targetColumn: string;
  }) => {
    console.log('💾 Saving relationship:', relationship);
    
    if (!connectionModal.connection) {
      console.error('Missing connection data for relationship creation');
      return;
    }

    // Check if we have the required block or table data
    const hasBlockData = connectionModal.sourceBlock && connectionModal.targetBlock;
    const hasTableData = connectionModal.sourceTable && connectionModal.targetTable;
    
    if (!hasBlockData && !hasTableData) {
      console.error('Missing required source/target data for relationship creation');
      return;
    }

    // Get table names for the label
    const sourceTableInfo = tablesData.find(t => t.id === relationship.sourceTable);
    const targetTableInfo = tablesData.find(t => t.id === relationship.targetTable);
    const sourceTableName = sourceTableInfo?.name || relationship.sourceTable.split('_').pop() || 'unknown';
    const targetTableName = targetTableInfo?.name || relationship.targetTable.split('_').pop() || 'unknown';

    // Create new edge with relationship metadata
    const newEdge: Edge = {
      id: `edge-${Date.now()}`,
      source: connectionModal.connection.source!,
      target: connectionModal.connection.target!,
      sourceHandle: connectionModal.connection.sourceHandle,
      targetHandle: connectionModal.connection.targetHandle,
      type: 'smoothstep',
      animated: false,
      style: {
        stroke: '#22c55e',
        strokeWidth: 2,
        strokeDasharray: '5,5',
      },
      label: `${sourceTableName} → ${targetTableName}`,
      data: {
        sourceTable: relationship.sourceTable,
        sourceColumn: relationship.sourceColumn,
        targetTable: relationship.targetTable,
        targetColumn: relationship.targetColumn,
      },
    };

    // Add to ReactFlow state
    setEdges((eds) => addEdge(newEdge, eds));
    
    // Create relationship in persistence layer (this will trigger auto-save)
    createRelationship({
      sourceId: state.sourceId || '',
      targetId: state.sourceId || '', // Same source for intra-source relationships
      sourceTableId: relationship.sourceTable,
      targetTableId: relationship.targetTable,
      sourceColumnName: relationship.sourceColumn,
      targetColumnName: relationship.targetColumn,
      relationshipType: 'semantic_link',
      confidenceScore: 1.0,
      visualStyle: 'solid',
      lineColor: '#22c55e',
      lineWidth: 2,
      isSelected: false,
    });
    
    // Close modal
    setConnectionModal({ isOpen: false });
    
    console.log('✅ Relationship created successfully');
  }, [connectionModal, setEdges, createRelationship, tablesData]);

  // Plus button handler
  const handleAddDataSource = useCallback(() => {
    console.log('Add data source clicked');
    setShowConnectWizard(true);
  }, []);
  
  const handleWizardClose = useCallback(() => {
    setShowConnectWizard(false);
    // Refresh canvas data after wizard closes
    setTimeout(async () => {
      await refreshCanvas();
    }, 100);
  }, [refreshCanvas]);

  const handleBreadcrumbNavigation = useCallback((level: string, path: string[]) => {
    const transition = createDefaultTransition('drill-up');
    navigateToBreadcrumb(level, path, transition);
  }, [navigateToBreadcrumb]);

  const handleNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node<DataSourceNodeData>) => {
    console.log('🔍 Double-clicked node:', node.data.name);
    
    // Only allow drill-down when we're at the sources level
    if (state.currentLevel !== 'sources') {
      console.log('Already at tables level, ignoring double-click');
      return;
    }

    // Check if the data source is connected and crawled
    if (node.data.connectionStatus !== 'connected' || node.data.crawlStatus !== 'crawled') {
      console.log('Data source not ready for drill-down:', {
        connectionStatus: node.data.connectionStatus,
        crawlStatus: node.data.crawlStatus
      });
      return;
    }

    // Drill down to tables view
    const transition = createDefaultTransition('drill-down');
    drillDown({
      sourceId: node.data.id,
      sourceName: node.data.name,
      sourceKind: node.data.kind,
      database: node.data.databaseName || 'default',
      schema: 'public', // TODO: Get actual schema from metadata
      tables: [] // TODO: Load actual tables from metadata
    }, transition);

    // Refresh canvas data to load any existing relationships
    refreshCanvas();
  }, [state.currentLevel, drillDown, refreshCanvas]);

  // Initial load effect
  useEffect(() => {
    const loadInitialState = async () => {
      setIsInitialLoad(true);
      await refreshCanvas();
      setIsInitialLoad(false);
    };
    loadInitialState();
  }, [refreshCanvas]);

  // Note: Auto-save is handled by the debounced save mechanism
  // Changes are automatically saved after 5 seconds of inactivity

  return (
    <div className={`canvas-workspace ${className}`}>
      <CanvasLoadingScreen visible={isInitialLoad} message="Creating map..." />
      
      {/* Breadcrumb navigation */}
      <CanvasBreadcrumbs 
        breadcrumbs={state.breadcrumbs}
        onNavigate={handleBreadcrumbNavigation}
      />
      
      {/* Canvas header */}
      <div className="canvas-workspace__header">
        <h1 className="canvas-workspace__title">
          {state.currentLevel === 'sources' ? 'Data Sources Canvas' : `Tables in ${state.sourceName} (${tablesData.length} tables)`}
        </h1>
        
        {/* Auto-save status indicator */}
        <div className="canvas-workspace__status">
          {isSaving && (
            <div className="canvas-workspace__status-item saving">
              <div className="canvas-workspace__status-spinner"></div>
              <span>Saving...</span>
            </div>
          )}
          {hasUnsavedChanges && !isSaving && (
            <div className="canvas-workspace__status-item pending">
              <span>Unsaved changes</span>
            </div>
          )}
          {!hasUnsavedChanges && !isSaving && (
            <div className="canvas-workspace__status-item saved">
              <span>✓ All changes saved</span>
            </div>
          )}
        </div>
        <div className="canvas-workspace__controls">
          <button 
            className="canvas-workspace__control-btn"
            onClick={() => setShowHelpModal(!showHelpModal)}
            title="Toggle help"
          >
            Help
          </button>
        </div>
      </div>

      {/* ReactFlow Canvas */}
      <div className="canvas-workspace__content" style={{ width: '100%', height: 'calc(100vh - 120px)' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onNodeDoubleClick={handleNodeDoubleClick}
          onEdgeContextMenu={onEdgeContextMenu}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.1}
          maxZoom={3}
          defaultEdgeOptions={{
            type: 'smoothstep',
            animated: false,
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(150, 150, 150, 0.3)" />
          <Controls showInteractive={false} />
          <MiniMap 
            nodeColor={(node) => {
              const data = node.data as DataSourceNodeData;
              switch (data.kind) {
                case 'postgres': return '#336791';
                case 'mysql': return '#00758F';
                case 'mongo': return '#4DB33D';
                case 'duckdb': return '#FFA500';
                default: return '#6B7280';
              }
            }}
            maskColor="rgba(0, 0, 0, 0.6)"
          />
          
          {/* Floating Plus Button */}
          <Panel position="bottom-right">
            <FloatingPlusButton 
              onClick={handleAddDataSource}
              tooltip="Add new data source"
            />
          </Panel>
        </ReactFlow>
      </div>

      {/* Help Modal */}
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
                <li><strong>Left mouse + drag:</strong> Pan canvas</li>
                <li><strong>Drag nodes:</strong> Reposition data sources</li>
                <li><strong>Double-click nodes:</strong> Explore tables within data source</li>
                <li><strong>Drag from connection points:</strong> Create relationships</li>
                <li><strong>Controls:</strong> Use buttons in bottom-left for zoom</li>
                <li><strong>Mini-map:</strong> Overview in bottom-right</li>
              </ul>
              <p className="help-note">
                Connect data sources by dragging from the connection handles (dots) that appear when you hover over a node.
                Double-click any connected data source to explore its tables and collections.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Canvas Connect Wizard Modal */}
      <CanvasConnectWizard 
        isOpen={showConnectWizard} 
        onClose={handleWizardClose} 
      />
      
      {/* Connection Configuration Modal */}
      <ConnectionModal
        isOpen={connectionModal.isOpen}
        onClose={() => setConnectionModal({ isOpen: false })}
        sourceBlock={connectionModal.sourceBlock}
        targetBlock={connectionModal.targetBlock}
        sourceTable={connectionModal.sourceTable}
        targetTable={connectionModal.targetTable}
        onSaveRelationship={handleSaveRelationship}
      />
      
      {/* Data Source Context Menu */}
      <DataSourceContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        visible={contextMenu.visible}
        sourceId={contextMenu.sourceId}
        blockId={contextMenu.blockId}
        onClose={handleCloseContextMenu}
        onRetryCrawl={handleContextMenuRetry}
        onDelete={handleDeleteBlock}
        canRetryCrawl={contextMenu.sourceId ? 
          canvasData?.blocks?.find(b => b.sourceId === contextMenu.sourceId)?.source?.crawlStatus === 'error' ||
          canvasData?.blocks?.find(b => b.sourceId === contextMenu.sourceId)?.source?.connectionStatus === 'error'
          : false
        }
      />

      {/* Relationship Context Menu */}
      <RelationshipContextMenu
        x={relationshipContextMenu.x}
        y={relationshipContextMenu.y}
        visible={relationshipContextMenu.visible}
        relationshipId={relationshipContextMenu.relationshipId}
        onClose={handleCloseRelationshipContextMenu}
        onDelete={handleDeleteRelationship}
      />
    </div>
  );
}
