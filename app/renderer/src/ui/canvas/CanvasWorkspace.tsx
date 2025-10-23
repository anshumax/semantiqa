import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
import './CanvasWorkspace.css';

// Custom node types for ReactFlow
const nodeTypes: NodeTypes = {
  dataSource: DataSourceNode,
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
  
  // Load canvas data from persistence layer
  const { data: canvasData, refresh: refreshCanvas } = useCanvasPersistence();
  
  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState<DataSourceNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  
  // Tables data for tables view
  const [tablesData, setTablesData] = useState<TableInfo[]>([]);
  
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

  // Convert canvas blocks to ReactFlow nodes based on current level
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
          },
        };
      });

      setNodes(flowNodes);
    } else if (state.currentLevel === 'tables') {
      // Show table nodes
      const flowNodes = tablesData.map((table, index) => {
        return {
          id: `table-${table.id}`,
          type: 'dataSource', // We'll use the same node type for now
          position: { 
            x: 100 + (index % 3) * 250, 
            y: 100 + Math.floor(index / 3) * 150 
          },
          data: {
            id: table.id,
            name: table.name,
            kind: (state.sourceKind || 'postgres') as DataSourceNodeData['kind'],
            connectionStatus: 'connected' as const,
            crawlStatus: 'crawled' as const,
            tableCount: table.rowCount,
          },
        };
      });

      setNodes(flowNodes);
    }
  }, [canvasData?.blocks, state.currentLevel, state.sourceId, state.sourceKind, tablesData, setNodes]);

  // Convert canvas relationships to ReactFlow edges
  useEffect(() => {
    if (!canvasData?.relationships) return;

    const flowEdges: Edge[] = canvasData.relationships.map((rel) => ({
      id: rel.id,
      source: rel.sourceBlockId,
      target: rel.targetBlockId,
      type: 'smoothstep',
      animated: false,
      style: {
        stroke: rel.type === 'cross-source' ? '#22c55e' : '#3b82f6',
        strokeWidth: 2,
        strokeDasharray: rel.type === 'cross-source' ? '5,5' : undefined,
      },
      label: rel.label,
    }));

    setEdges(flowEdges);
  }, [canvasData?.relationships, setEdges]);

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

    setEdges((eds) => addEdge(newEdge, eds));
    
    // Close modal
    setConnectionModal({ isOpen: false });
    
    console.log('✅ Relationship created successfully');
  }, [connectionModal, setEdges]);

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
  }, [state.currentLevel, drillDown]);

  return (
    <div className={`canvas-workspace ${className}`}>
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
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDoubleClick={handleNodeDoubleClick}
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
    </div>
  );
}
