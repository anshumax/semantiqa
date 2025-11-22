import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
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
import { TableContextMenu } from './TableContextMenu';
import { RelationshipContextMenu } from './RelationshipContextMenu';
import { CanvasPaneContextMenu } from './CanvasPaneContextMenu';
import { CanvasLoadingScreen } from './CanvasLoadingScreen';
import { CrawlFinalizingOverlay } from './CrawlFinalizingOverlay';
import { CanvasInspector, type InspectorSelection } from './inspector/CanvasInspector';
import { ConfirmDialog } from './ConfirmDialog';
import { IPC_CHANNELS } from '@semantiqa/app-config';
import { applyAutoLayout, updateEdgeHandles, calculateOptimalHandles } from './layoutService';
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
  
  // Crawl finalizing overlay state
  const [finalizingSource, setFinalizingSource] = useState<string | null>(null);
  
  // Connectivity check state
  const [connectivityCheck, setConnectivityCheck] = useState<{
    checking: boolean;
    total: number;
    completed: number;
  }>({
    checking: false,
    total: 0,
    completed: 0,
  });
  
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
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    sourceId: string;
    sourceName: string;
  }>({
    isOpen: false,
    sourceId: '',
    sourceName: '',
  });
  
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

  // Table context menu state
  const [tableContextMenu, setTableContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    tableId: string;
    sourceId: string;
  }>({
    visible: false,
    x: 0,
    y: 0,
    tableId: '',
    sourceId: '',
  });

  // Pane context menu state
  const [paneContextMenu, setPaneContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
  }>({
    visible: false,
    x: 0,
    y: 0,
  });
  
  // Inspector selection state
  const [inspectorSelection, setInspectorSelection] = useState<InspectorSelection | null>(null);
  
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
    
    // Close other menus
    setTableContextMenu(prev => ({ ...prev, visible: false }));
    setRelationshipContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  const handleTableContextMenu = useCallback((event: React.MouseEvent, tableId: string, sourceId: string) => {
    event.preventDefault();
    event.stopPropagation();
    
    setTableContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      tableId: tableId,
      sourceId: sourceId,
    });
    
    // Close other menus
    setContextMenu(prev => ({ ...prev, visible: false }));
    setRelationshipContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  const handleCloseTableContextMenu = useCallback(() => {
    setTableContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  const handleContextMenuRetry = useCallback(() => {
    if (contextMenu.sourceId) {
      handleRetryCrawl(contextMenu.sourceId);
    }
    handleCloseContextMenu();
  }, [contextMenu.sourceId, handleRetryCrawl, handleCloseContextMenu]);

  const handleContextMenuRetryConnection = useCallback(async () => {
    if (contextMenu.sourceId) {
      await window.semantiqa?.api.invoke('sources:test-connection', { sourceId: contextMenu.sourceId });
    }
    handleCloseContextMenu();
  }, [contextMenu.sourceId, handleCloseContextMenu]);

  const handleDeleteTableBlock = useCallback((tableId: string) => {
    console.log('Deleting table block:', tableId);
    // Table blocks are identified with the table- prefix
    const blockId = `table-${tableId}`;
    deleteBlock(blockId, tableContextMenu.sourceId);
    refreshCanvas();
  }, [deleteBlock, refreshCanvas, tableContextMenu.sourceId]);

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
    console.log('🗑️ handleDeleteRelationship called with:', relationshipId);
    
    // Also remove from ReactFlow edges state
    setEdges((eds) => {
      const filtered = eds.filter(e => e.id !== relationshipId);
      return filtered;
    });
    
    // Remove from persistence layer
    deleteRelationship(relationshipId);
    
    console.log('🗑️ Deletion complete, refreshing canvas');
  }, [deleteRelationship, edges, setEdges]);

  // Handle block deletion from context menu - show confirmation dialog
  const handleDeleteBlock = useCallback((blockId: string, sourceId: string) => {
    console.log('Delete data source requested:', { blockId, sourceId });
    
    // Find the source name from nodes
    const sourceNode = nodes.find(n => n.id === blockId);
    const sourceName = sourceNode?.data?.name || 'this data source';
    
    // Show confirmation dialog
    setConfirmDialog({
      isOpen: true,
      sourceId,
      sourceName,
    });
    
    // Close context menu
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, [nodes]);

  // Confirm deletion of data source
  const handleConfirmDelete = useCallback(async () => {
    const { sourceId, sourceName } = confirmDialog;
    console.log('🗑️ Confirming deletion of data source:', { sourceId, sourceName });
    
    try {
      // Call backend to delete data source comprehensively
      const response = await window.semantiqa?.api.invoke(
        IPC_CHANNELS.SOURCES_DELETE,
        { sourceId }
      );
      
      if (response && 'success' in response && response.success) {
        console.log('✅ Data source deleted successfully:', response.deletedCounts);
        // Refresh canvas to update UI
        await refreshCanvas();
      } else {
        console.error('❌ Failed to delete data source:', response);
        alert('Failed to delete data source. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error deleting data source:', error);
      alert('An error occurred while deleting the data source.');
    } finally {
      // Close confirmation dialog
      setConfirmDialog({ isOpen: false, sourceId: '', sourceName: '' });
    }
  }, [confirmDialog, refreshCanvas]);

  // Cancel deletion
  const handleCancelDelete = useCallback(() => {
    setConfirmDialog({ isOpen: false, sourceId: '', sourceName: '' });
  }, []);

  // Close relationship context menu
  const handleCloseRelationshipContextMenu = useCallback(() => {
    setRelationshipContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  // Handle canvas clicks to close context menus and inspector
  const onPaneClick = useCallback(() => {
    setContextMenu(prev => ({ ...prev, visible: false }));
    setTableContextMenu(prev => ({ ...prev, visible: false }));
    setRelationshipContextMenu(prev => ({ ...prev, visible: false }));
    setPaneContextMenu(prev => ({ ...prev, visible: false }));
    setInspectorSelection(null);
  }, []);

  // Handle pane context menu (right-click on canvas background)
  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    
    setPaneContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
    });
    
    // Close other menus
    setContextMenu(prev => ({ ...prev, visible: false }));
    setTableContextMenu(prev => ({ ...prev, visible: false }));
    setRelationshipContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  // Handle auto-arrange action
  const handleAutoArrange = useCallback(() => {
    console.log('🎨 Auto-arranging nodes...');
    
    if (nodes.length === 0) {
      console.log('No nodes to arrange');
      return;
    }
    
    // Apply dagre layout algorithm
    const layoutedNodes = applyAutoLayout(nodes, edges, {
      direction: 'TB',
      nodeWidth: 250,
      nodeHeight: 120,
      rankSep: 150,
      nodeSep: 100,
    });
    
    // Calculate optimal connection handles based on new positions
    const updatedEdges = updateEdgeHandles(layoutedNodes, edges, 250, 120);
    
    console.log(`🔗 Updated ${updatedEdges.length} edges with optimal handles`);
    
    // Update nodes with new positions
    setNodes(layoutedNodes);
    
    // Update edges with new handles
    setEdges(updatedEdges);
    
    // Update block positions in persistence layer
    layoutedNodes.forEach(node => {
      updateBlockPosition(node.id, node.position);
    });
    
    // Update relationship handles in persistence layer
    if (canvasData?.relationships && updatedEdges.length > 0) {
      // Create a map of edge handles by edge ID
      const edgeHandlesMap = new Map(
        updatedEdges.map(edge => [edge.id, { 
          sourceHandle: edge.sourceHandle, 
          targetHandle: edge.targetHandle 
        }])
      );
      
      // Update relationships with new handles while preserving all fields
      const relationshipUpdates = canvasData.relationships
        .filter(rel => edgeHandlesMap.has(rel.id))
        .map(rel => {
          const handles = edgeHandlesMap.get(rel.id)!;
          return {
            ...rel, // Preserve all existing fields
            sourceHandle: handles.sourceHandle || undefined,
            targetHandle: handles.targetHandle || undefined,
          };
        });
      
      if (relationshipUpdates.length > 0) {
        console.log(`💾 Updating ${relationshipUpdates.length} relationship handles`);
        updateCanvas({ relationships: relationshipUpdates });
      }
    }
    
    console.log('✅ Auto-arrange complete');
  }, [nodes, edges, setNodes, setEdges, updateBlockPosition, updateCanvas, canvasData?.relationships]);

  // Handle retry all connectivity checks
  const handleRetryAllConnectivity = useCallback(async () => {
    if (!canvasData?.blocks) return;
    
    const sourceIdsWithErrors = canvasData.blocks
      .filter(b => b.type === 'source' && b.connectionStatus === 'error')
      .map(b => b.sourceId);
    
    console.log(`🔄 Retrying connectivity for ${sourceIdsWithErrors.length} sources with errors`);
    
    for (const sourceId of sourceIdsWithErrors) {
      await window.semantiqa?.api.invoke('sources:test-connection', { sourceId });
    }
  }, [canvasData?.blocks]);

  // Check if there are any connectivity errors
  const hasConnectivityErrors = useMemo(() => {
    return canvasData?.blocks?.some(b => b.type === 'source' && b.connectionStatus === 'error') ?? false;
  }, [canvasData?.blocks]);

  // Close pane context menu
  const handleClosePaneContextMenu = useCallback(() => {
    setPaneContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  // Handle "View Details" from data source context menu
  const handleViewSourceDetails = useCallback(() => {
    if (contextMenu.sourceId) {
      setInspectorSelection({
        type: 'data-source',
        id: contextMenu.sourceId,
      });
    }
  }, [contextMenu.sourceId]);

  // Handle "View Details" from table context menu
  const handleViewTableDetails = useCallback(() => {
    if (tableContextMenu.tableId && tableContextMenu.sourceId) {
      setInspectorSelection({
        type: 'table',
        id: tableContextMenu.tableId,
        sourceId: tableContextMenu.sourceId,
      });
    }
  }, [tableContextMenu.tableId, tableContextMenu.sourceId]);


  // Close inspector when navigation level changes
  useEffect(() => {
    setInspectorSelection(null);
  }, [state.currentLevel]);

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
  // Track if we've already created nodes for this view (to prevent recreation)
  const nodesCreatedRef = useRef(false);
  // Track if auto-arrange has been applied for current view
  const autoArrangeAppliedRef = useRef(false);

  // Convert table data to ReactFlow nodes for tables view (separate effect to avoid recreation)
  useEffect(() => {
    if (state.currentLevel === 'tables') {
      if (tablesData.length > 0 && !nodesCreatedRef.current) {
        // Only create nodes ONCE when entering tables view
        nodesCreatedRef.current = true;
        
        // Get saved table block positions from canvas data
        const savedTableBlocks = canvasData?.tableBlocks || [];
        const tableBlocksMap = new Map(savedTableBlocks.map(tb => [tb.tableId, tb.position]));
        
        // Collect new table blocks that need to be created (outside the map loop)
        const newTableBlocksToCreate: Array<Omit<CanvasTableBlock, 'createdAt' | 'updatedAt'>> = [];
        
        // Show table nodes
        const flowNodes = tablesData.map((table, index) => {
          // Check if we have a saved position for this table
          const savedPosition = tableBlocksMap.get(table.id);
          const position = savedPosition 
            ? { x: savedPosition.x, y: savedPosition.y }
            : { 
                x: 100 + (index % 3) * 250, 
                y: 100 + Math.floor(index / 3) * 150 
              };
          
          // Queue table block creation if it doesn't exist AND hasn't been initialized yet
          if (!savedPosition && state.sourceId && !initializedTablesRef.current.has(table.id)) {
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
              onContextMenu: (event: React.MouseEvent) => handleTableContextMenu(event, table.id, table.sourceId),
            },
          };
        });

        setNodes(flowNodes);
        
        // Create new table blocks in a single batch (only happens once per table)
        if (newTableBlocksToCreate.length > 0) {
          console.log('📦 Creating initial table blocks:', newTableBlocksToCreate.length);
          updateCanvas({ tableBlocks: newTableBlocksToCreate });
        }
      } else if (tablesData.length === 0) {
        // Clear nodes when no table data
        setNodes([]);
        nodesCreatedRef.current = false;
      }
    } else {
      // Clear the initialized tables when leaving table view
      initializedTablesRef.current.clear();
      nodesCreatedRef.current = false;
    }
  }, [tablesData, state.currentLevel, state.sourceKind, state.sourceId, canvasData?.tableBlocks, setNodes, updateCanvas, handleTableContextMenu]);

  // Auto-arrange on first view
  useEffect(() => {
    // Don't auto-arrange if already done or no nodes
    if (autoArrangeAppliedRef.current || nodes.length === 0) {
      return;
    }
    
    // Check if this view has been auto-arranged before using localStorage
    const storageKey = state.currentLevel === 'tables' 
      ? `auto-arranged-tables-${state.sourceId}` 
      : `auto-arranged-sources`;
    
    const hasBeenArranged = localStorage.getItem(storageKey) === 'true';
    
    if (!hasBeenArranged) {
      console.log(`🎨 Applying automatic layout for ${state.currentLevel} view (first time)`);
      
      // Small delay to ensure nodes are fully initialized
      setTimeout(() => {
        const layoutedNodes = applyAutoLayout(nodes, edges, {
          direction: 'TB',
          nodeWidth: 250,
          nodeHeight: 120,
          rankSep: 150,
          nodeSep: 100,
        });
        
        // Calculate optimal connection handles based on new positions
        const updatedEdges = updateEdgeHandles(layoutedNodes, edges, 250, 120);
        
        setNodes(layoutedNodes);
        setEdges(updatedEdges);
        
        // Update positions in persistence
        layoutedNodes.forEach(node => {
          updateBlockPosition(node.id, node.position);
        });
        
        // Update relationship handles in persistence layer
        if (canvasData?.relationships && updatedEdges.length > 0) {
          // Create a map of edge handles by edge ID
          const edgeHandlesMap = new Map(
            updatedEdges.map(edge => [edge.id, { 
              sourceHandle: edge.sourceHandle, 
              targetHandle: edge.targetHandle 
            }])
          );
          
          // Update relationships with new handles while preserving all fields
          const relationshipUpdates = canvasData.relationships
            .filter(rel => edgeHandlesMap.has(rel.id))
            .map(rel => {
              const handles = edgeHandlesMap.get(rel.id)!;
              return {
                ...rel, // Preserve all existing fields
                sourceHandle: handles.sourceHandle || undefined,
                targetHandle: handles.targetHandle || undefined,
              };
            });
          
          if (relationshipUpdates.length > 0) {
            console.log(`💾 Updating ${relationshipUpdates.length} relationship handles (auto-layout)`);
            updateCanvas({ relationships: relationshipUpdates });
          }
        }
        
        // Mark as arranged
        localStorage.setItem(storageKey, 'true');
        autoArrangeAppliedRef.current = true;
        
        console.log('✅ Automatic layout applied');
      }, 100);
    } else {
      // Already arranged previously
      autoArrangeAppliedRef.current = true;
    }
  }, [nodes, edges, state.currentLevel, state.sourceId, setNodes, setEdges, updateBlockPosition, updateCanvas, canvasData?.relationships]);

  // Reset auto-arrange flag when changing views
  useEffect(() => {
    autoArrangeAppliedRef.current = false;
  }, [state.currentLevel, state.sourceId]);

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

    console.log(`🔗 Converting ${filteredRelationships.length} relationships to edges`);

    const flowEdges: Edge[] = filteredRelationships.map((rel) => {
      // For table relationships, we need to map table IDs to ReactFlow node IDs
      const sourceNodeId = state.currentLevel === 'tables' 
        ? `table-${rel.sourceTableId}` 
        : rel.sourceId;
      const targetNodeId = state.currentLevel === 'tables' 
        ? `table-${rel.targetTableId}` 
        : rel.targetId;

      // Check if either endpoint has connectivity error (for source-level relationships only)
      let hasConnectivityError = false;
      if (state.currentLevel === 'sources') {
        const sourceBlock = canvasData?.blocks?.find(b => b.sourceId === rel.sourceId);
        const targetBlock = canvasData?.blocks?.find(b => b.sourceId === rel.targetId);
        hasConnectivityError = 
          sourceBlock?.connectionStatus === 'error' || 
          targetBlock?.connectionStatus === 'error';
      }

      return {
        id: rel.id,
        source: sourceNodeId,
        target: targetNodeId,
        sourceHandle: rel.sourceHandle || undefined,
        targetHandle: rel.targetHandle || undefined,
        type: 'default',
        animated: false,
        style: {
          stroke: hasConnectivityError ? '#ef4444' : (rel.lineColor || '#22c55e'),
          strokeWidth: rel.lineWidth || 2,
          strokeDasharray: rel.visualStyle === 'dashed' ? '5,5' : undefined,
          cursor: 'pointer',
        },
        className: 'canvas-edge',
        label: `${rel.sourceTableId?.split('_').pop() || 'source'} → ${rel.targetTableId?.split('_').pop() || 'target'}`,
      };
    });

    setEdges(flowEdges);
  }, [canvasData?.relationships, canvasData?.blocks, setEdges, state.currentLevel, state.sourceId]);

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
    console.log('💾 Connection modal data:', {
      connection: connectionModal.connection,
      sourceHandle: connectionModal.connection?.sourceHandle,
      targetHandle: connectionModal.connection?.targetHandle
    });
    
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

    // Calculate optimal handles based on node positions
    const sourceNode = nodes.find(n => n.id === connectionModal.connection?.source);
    const targetNode = nodes.find(n => n.id === connectionModal.connection?.target);
    let optimalHandles = {
      sourceHandle: connectionModal.connection.sourceHandle,
      targetHandle: connectionModal.connection.targetHandle
    };
    
    if (sourceNode && targetNode) {
      const { sourceHandle, targetHandle } = calculateOptimalHandles(sourceNode, targetNode);
      optimalHandles = { sourceHandle, targetHandle };
      console.log('🎯 Calculated optimal handles:', optimalHandles);
    }

    // Create new edge with relationship metadata and optimal handles
    const newEdge: Edge = {
      id: `edge-${Date.now()}`,
      source: connectionModal.connection.source!,
      target: connectionModal.connection.target!,
      sourceHandle: optimalHandles.sourceHandle,
      targetHandle: optimalHandles.targetHandle,
      type: 'default',
      animated: false,
      style: {
        stroke: '#22c55e',
        strokeWidth: 2,
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
      sourceHandle: optimalHandles.sourceHandle || undefined,
      targetHandle: optimalHandles.targetHandle || undefined,
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
  }, [connectionModal, setEdges, createRelationship, tablesData, nodes, state.sourceId]);

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

  // Trigger connectivity check on canvas mount (after initial load)
  useEffect(() => {
    const startConnectivityCheck = async () => {
      if (!canvasData?.blocks) return;
      
      // Get unique source IDs from canvas blocks
      const sourceIds = [...new Set(
        canvasData.blocks
          .filter(b => b.type === 'source')
          .map(b => b.sourceId)
      )];
      
      if (sourceIds.length === 0) return;
      
      setConnectivityCheck({
        checking: true,
        total: sourceIds.length,
        completed: 0,
      });
      
      // Queue checks for all sources (async, non-blocking)
      for (const sourceId of sourceIds) {
        await window.semantiqa?.api.invoke('sources:test-connection', { sourceId });
      }
    };
    
    if (canvasData && !isInitialLoad) {
      void startConnectivityCheck();
    }
  }, [canvasData, isInitialLoad]);

  // Listen for connectivity updates
  useEffect(() => {
    const handleConnectionStatus = (event: any, payload: any) => {
      if (payload.kind === 'connection') {
        setConnectivityCheck(prev => ({
          ...prev,
          completed: prev.completed + 1,
        }));
        
        // Update node status in-place (no DB refresh)
        setNodes(nodes => 
          nodes.map(node => 
            node.id === payload.sourceId
              ? { ...node, data: { ...node.data, connectionStatus: payload.connectionStatus } }
              : node
          )
        );
      }
    };
    
    window.electron?.ipcRenderer?.on('sources:status', handleConnectionStatus);
    return () => {
      window.electron?.ipcRenderer?.off('sources:status', handleConnectionStatus);
    };
  }, [setNodes]);

  // Listen for crawl completion to show finalizing overlay and update status in-memory
  useEffect(() => {
    const handleStatusChange = (event: any, payload: any) => {
      console.log('🎯 Source status changed:', payload);
      
      // Update connection status in-memory
      if (payload.kind === 'connection') {
        setNodes(nodes =>
          nodes.map(node =>
            node.id === payload.sourceId
              ? { ...node, data: { ...node.data, connectionStatus: payload.connectionStatus } }
              : node
          )
        );
        
        // Re-compute edge colors when connectivity changes
        setEdges(edges =>
          edges.map(edge => {
            const sourceNode = nodes.find(n => n.id === edge.source);
            const targetNode = nodes.find(n => n.id === edge.target);
            const hasError =
              sourceNode?.data?.connectionStatus === 'error' ||
              targetNode?.data?.connectionStatus === 'error';
            
            return {
              ...edge,
              style: {
                ...edge.style,
                stroke: hasError ? '#ef4444' : (edge.style?.stroke || '#22c55e'),
              },
            };
          })
        );
      }
      
      // Update crawl status and metadata in-memory
      if (payload.kind === 'crawl') {
        setNodes(nodes =>
          nodes.map(node =>
            node.id === payload.sourceId
              ? { ...node, data: { ...node.data, crawlStatus: payload.crawlStatus, tableCount: payload.tableCount } }
              : node
          )
        );
      }
      
      // Show overlay when crawl completes
      if (payload.crawlStatus === 'crawled' && payload.connectionStatus === 'connected') {
        const sourceName = payload.sourceName || 'Data Source';
        console.log(`✨ Showing finalizing overlay for: ${sourceName}`);
        setFinalizingSource(sourceName);
        
        // Hide overlay after brief delay (no DB refresh needed)
        setTimeout(() => {
          console.log('✅ Hiding finalizing overlay');
          setFinalizingSource(null);
        }, 1100);
      }
      
      // Add new source block when source is added
      if (payload.kind === 'source_added' && payload.block) {
        const newNode = {
          id: payload.sourceId,
          type: 'dataSource',
          position: payload.block.position,
          data: {
            id: payload.sourceId,
            name: payload.sourceName,
            kind: payload.block.kind,
            connectionStatus: payload.connectionStatus,
            crawlStatus: payload.crawlStatus,
            onRetryCrawl: handleRetryCrawl,
            onContextMenu: (event: React.MouseEvent) => handleContextMenu(event, payload.block.id, payload.sourceId),
          },
        };
        setNodes(nodes => [...nodes, newNode]);
      }
    };
    
    // Subscribe to source status changes
    window.electron?.ipcRenderer?.on('sources:status', handleStatusChange);
    
    // Cleanup
    return () => {
      window.electron?.ipcRenderer?.off('sources:status', handleStatusChange);
    };
  }, [nodes, setNodes, setEdges, handleRetryCrawl, handleContextMenu]);

  // Note: Auto-save is handled by the debounced save mechanism

  return (
    <div className={`canvas-workspace ${className}`}>
      <CanvasLoadingScreen visible={isInitialLoad} message="Creating map..." />
      <CrawlFinalizingOverlay 
        isVisible={!!finalizingSource} 
        sourceName={finalizingSource || ''} 
      />
      
      {/* Breadcrumb navigation */}
      <CanvasBreadcrumbs 
        breadcrumbs={state.breadcrumbs}
        onNavigate={handleBreadcrumbNavigation}
        onHelpClick={() => setShowHelpModal(!showHelpModal)}
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
      </div>

      {/* Connectivity check progress banner */}
      {connectivityCheck.checking && connectivityCheck.completed < connectivityCheck.total && (
        <div style={{
          position: 'absolute',
          top: '60px',
          left: 0,
          right: 0,
          zIndex: 1000,
          padding: '12px',
          background: 'rgba(66, 153, 225, 0.9)',
          color: 'white',
          textAlign: 'center',
          fontSize: '14px',
          fontWeight: 500,
        }}>
          Checking connectivity: {connectivityCheck.completed} / {connectivityCheck.total}
        </div>
      )}

      {/* ReactFlow Canvas */}
      <div className="canvas-workspace__content" style={{ width: '100%', flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onNodeDoubleClick={handleNodeDoubleClick}
          onEdgeContextMenu={onEdgeContextMenu}
          onPaneClick={onPaneClick}
          onPaneContextMenu={onPaneContextMenu}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.1}
          maxZoom={3}
          proOptions={{ hideAttribution: true }}
          connectionLineType={'default' as any}
          defaultEdgeOptions={{
            type: 'default',
            animated: false,
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(150, 150, 150, 0.3)" />
          <Controls showInteractive={false} />
          
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
        onViewDetails={handleViewSourceDetails}
        onRetryCrawl={handleContextMenuRetry}
        onRetryConnection={handleContextMenuRetryConnection}
        onDelete={handleDeleteBlock}
        canRetryCrawl={contextMenu.sourceId ? 
          canvasData?.blocks?.find(b => b.sourceId === contextMenu.sourceId)?.source?.crawlStatus === 'error' ||
          canvasData?.blocks?.find(b => b.sourceId === contextMenu.sourceId)?.source?.connectionStatus === 'error'
          : false
        }
        hasConnectionError={contextMenu.sourceId ?
          canvasData?.blocks?.find(b => b.sourceId === contextMenu.sourceId)?.connectionStatus === 'error'
          : false
        }
      />

      {/* Table Context Menu */}
      <TableContextMenu
        x={tableContextMenu.x}
        y={tableContextMenu.y}
        visible={tableContextMenu.visible}
        tableId={tableContextMenu.tableId}
        sourceId={tableContextMenu.sourceId}
        onClose={handleCloseTableContextMenu}
        onViewDetails={handleViewTableDetails}
        onDelete={handleDeleteTableBlock}
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

      {/* Pane Context Menu */}
      <CanvasPaneContextMenu
        x={paneContextMenu.x}
        y={paneContextMenu.y}
        visible={paneContextMenu.visible}
        onClose={handleClosePaneContextMenu}
        onAutoArrange={handleAutoArrange}
        hasConnectivityErrors={hasConnectivityErrors}
        onRetryAllConnectivity={handleRetryAllConnectivity}
      />

      {/* Canvas Inspector */}
      <CanvasInspector
        selection={inspectorSelection}
        onClose={() => setInspectorSelection(null)}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Delete Data Source"
        message={`Are you sure you want to permanently delete "${confirmDialog.sourceName}"? This will remove all metadata, tables, relationships, embeddings, and canvas blocks associated with this data source. This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        confirmDangerous={true}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}
