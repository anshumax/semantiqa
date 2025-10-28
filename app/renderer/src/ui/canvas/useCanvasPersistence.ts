import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { IPC_CHANNELS } from '@semantiqa/app-config';
import type {
  CanvasGetRequest,
  CanvasGetResponse,
  CanvasUpdateRequest,
  CanvasUpdateResponse,
  CanvasSaveRequest,
  CanvasSaveResponse,
  CanvasState,
  CanvasBlock,
  CanvasTableBlock,
  CanvasRelationship,
  CanvasViewport,
  CanvasPosition,
} from '@semantiqa/contracts';

export type CanvasPersistenceState =
  | { status: 'idle'; data: null }
  | { status: 'loading'; data: CanvasData | null }
  | { status: 'ready'; data: CanvasData }
  | { status: 'error'; data: CanvasData | null; error: Error }
  | { status: 'saving'; data: CanvasData };

export interface CanvasData {
  canvas: CanvasState;
  blocks: CanvasBlock[];
  tableBlocks?: CanvasTableBlock[];
  relationships: CanvasRelationship[];
}

export interface CanvasPersistenceOptions {
  canvasId?: string;
  autoSave?: boolean;
  autoSaveDelay?: number;
}

export function useCanvasPersistence(options: CanvasPersistenceOptions = {}) {
  const {
    canvasId = 'default',
    autoSave = true,
    autoSaveDelay = 2000, // 2 seconds
  } = options;

  const [state, setState] = useState<CanvasPersistenceState>({ status: 'idle', data: null });
  const [pendingChanges, setPendingChanges] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSaveRef = useRef<number>(0);

  // In-memory state tracking
  const [inMemoryBlocks, setInMemoryBlocks] = useState<Map<string, CanvasBlock>>(new Map());
  const [inMemoryTableBlocks, setInMemoryTableBlocks] = useState<Map<string, CanvasTableBlock>>(new Map());
  const [inMemoryRelationships, setInMemoryRelationships] = useState<Map<string, CanvasRelationship>>(new Map());

  // Single save method for all changes
  const saveAllToDatabase = useCallback(async () => {
    if (!hasUnsavedChanges) return;
    
    console.log('💾 Saving all canvas state to database...');
    setState(prev => prev.status === 'ready' ? { status: 'saving', data: prev.data } : prev);
    
    try {
      const blocks = Array.from(inMemoryBlocks.values());
      const tableBlocks = Array.from(inMemoryTableBlocks.values());
      const relationships = Array.from(inMemoryRelationships.values());
      
      console.log('💾 Blocks to save:', blocks.map(b => ({ id: b.id, position: b.position })));
      console.log('💾 Table blocks to save:', tableBlocks.map(tb => ({ id: tb.id, position: tb.position })));
      console.log('💾 Relationships to save:', relationships.map(r => ({ 
        id: r.id, 
        sourceTableId: r.sourceTableId?.split('_').pop(),
        targetTableId: r.targetTableId?.split('_').pop(),
        sourceHandle: r.sourceHandle,
        targetHandle: r.targetHandle 
      })));
      
      const request: CanvasUpdateRequest = {
        canvasId,
        blocks,
        tableBlocks,
        relationships,
      };
      
      console.log('🔌 Frontend calling IPC:', {
        channel: IPC_CHANNELS.CANVAS_UPDATE,
        request: request
      });
      
      const response = (await window.semantiqa?.api.invoke(
        IPC_CHANNELS.CANVAS_UPDATE,
        request
      )) as CanvasUpdateResponse | undefined;
      
      console.log('🔌 Frontend received IPC response:', response);
      
      if (response?.success) {
        setHasUnsavedChanges(false);
        setPendingChanges(false);
        lastSaveRef.current = Date.now();
        console.log('✅ Canvas state saved successfully');
      } else {
        console.error('❌ Failed to save canvas state:', response);
      }
    } catch (error) {
      console.error('❌ Error saving canvas state:', error);
    } finally {
      setState(prev => prev.status === 'saving' ? { status: 'ready', data: prev.data } : prev);
    }
  }, [inMemoryBlocks, inMemoryTableBlocks, inMemoryRelationships, canvasId, hasUnsavedChanges]);

  // Debounced auto-save
  const debouncedSave = useDebouncedCallback(saveAllToDatabase, autoSaveDelay);

  // Load canvas data
  const loadCanvas = useCallback(async () => {
    console.log('🟣 Loading canvas data...');
    setState((prev) => ({ status: 'loading', data: prev.data }));

    try {
      const request: CanvasGetRequest = {
        canvasId,
        includeBlocks: true,
        includeRelationships: true,
      };
      
      console.log('🟣 Sending canvas:get request:', request);

      const response = (await window.semantiqa?.api.invoke(
        IPC_CHANNELS.CANVAS_GET,
        request
      )) as CanvasGetResponse | undefined;
      
      console.log('🟣 Canvas response:', response);

      if (!response) {
        console.error('🔥 No response from canvas:get');
        throw new Error('Failed to load canvas data');
      }

      const data: CanvasData = {
        canvas: response.canvas,
        blocks: response.blocks || [],
        tableBlocks: response.tableBlocks || [],
        relationships: response.relationships || [],
      };
      
      console.log('🟣 Canvas loaded successfully:', {
        blockCount: data.blocks.length,
        tableBlockCount: data.tableBlocks?.length || 0,
        relationshipCount: data.relationships.length
      });

      // Populate in-memory state from loaded data
      const blocksMap = new Map<string, CanvasBlock>();
      data.blocks.forEach(block => blocksMap.set(block.id, block));
      setInMemoryBlocks(blocksMap);

      // Load table blocks into memory
      const tableBlocksMap = new Map<string, CanvasTableBlock>();
      if (data.tableBlocks) {
        data.tableBlocks.forEach(tb => {
          tableBlocksMap.set(tb.id, tb);
        });
      }
      setInMemoryTableBlocks(tableBlocksMap);
      console.log('🟣 Loaded table blocks into memory:', tableBlocksMap.size);

      const relationshipsMap = new Map<string, CanvasRelationship>();
      data.relationships.forEach(rel => relationshipsMap.set(rel.id, rel));
      setInMemoryRelationships(relationshipsMap);
      
      console.log('🔄 Loaded relationships into memory:', {
        count: data.relationships.length,
        relationships: data.relationships.map(r => ({ id: r.id, sourceTableId: r.sourceTableId, targetTableId: r.targetTableId }))
      });

      setState({ status: 'ready', data });
      setPendingChanges(false);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('🔥 Canvas load failed:', error);
      
      // Create empty canvas data as fallback
      const fallbackData: CanvasData = {
        canvas: {
          id: canvasId,
          name: 'Default Canvas',
          viewport: { zoom: 1, centerX: 0, centerY: 0 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        blocks: [],
        relationships: [],
      };
      
      console.log('🟡 Using fallback canvas data');
      setState({ status: 'ready', data: fallbackData });
      setPendingChanges(false);
    }
  }, [canvasId]);

  // Update canvas data
  const updateCanvas = useCallback(async (updates: {
    canvas?: Partial<CanvasState>;
    blocks?: Partial<CanvasBlock>[];
    tableBlocks?: Partial<CanvasTableBlock>[];
    relationships?: Partial<CanvasRelationship>[];
    skipAutoSave?: boolean;
  }) => {
    console.log('🟨 updateCanvas called with:', updates);
    console.log('🟨 Current state status:', state.status);
    
    if (state.status !== 'ready') {
      console.error('🔥 Cannot update canvas - state is not ready:', state.status);
      return;
    }

    try {
      const request: CanvasUpdateRequest = {
        canvasId,
        canvas: updates.canvas,
        blocks: updates.blocks?.map(block => {
          if (!block.id) {
            throw new Error('Block ID is required for canvas updates');
          }
          return { ...block, id: block.id };
        }),
        tableBlocks: updates.tableBlocks?.map(tableBlock => {
          if (!tableBlock.id) {
            throw new Error('Table block ID is required for canvas updates');
          }
          return { ...tableBlock, id: tableBlock.id };
        }),
        relationships: updates.relationships?.map(rel => {
          if (!rel.id) {
            throw new Error('Relationship ID is required for canvas updates');
          }
          return { ...rel, id: rel.id };
        }),
      };

      console.log('🔌 Frontend calling IPC:', {
        channel: IPC_CHANNELS.CANVAS_UPDATE,
        request: request
      });
      
      const response = (await window.semantiqa?.api.invoke(
        IPC_CHANNELS.CANVAS_UPDATE,
        request
      )) as CanvasUpdateResponse | undefined;
      
      console.log('🔌 Frontend received IPC response:', response);

      if (!response || !response.success) {
        throw new Error('Failed to update canvas');
      }

      // Update local state with server response
      const updatedData: CanvasData = {
        canvas: response.updatedCanvas || state.data.canvas,
        blocks: response.updatedBlocks || state.data.blocks,
        relationships: response.updatedRelationships || state.data.relationships,
      };

      setState({ status: 'ready', data: updatedData });
      
      if (!updates.skipAutoSave) {
        setPendingChanges(true);
        
        // Trigger auto-save if enabled
        if (autoSave) {
          // Clear existing timeout
          if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
          }
          
          // Set new timeout
          autoSaveTimeoutRef.current = setTimeout(() => {
            void saveCanvas();
          }, autoSaveDelay);
        }
      }
    } catch (error) {
      setState((prev) => ({
        status: 'error',
        data: prev.data,
        error: error instanceof Error ? error : new Error('Failed to update canvas'),
      }));
    }
  }, [state.status, state.data, canvasId, autoSave, autoSaveDelay]);

  // Save canvas
  const saveCanvas = useCallback(async () => {
    if (state.status !== 'ready' && state.status !== 'saving') return;

    setState((prev) => ({ status: 'saving', data: prev.data! }));

    try {
      const request: CanvasSaveRequest = {
        canvasId,
        forceSave: false,
      };

      const response = (await window.semantiqa?.api.invoke(
        IPC_CHANNELS.CANVAS_SAVE,
        request
      )) as CanvasSaveResponse | undefined;

      if (!response || !response.success) {
        throw new Error('Failed to save canvas');
      }

      setState((prev) => ({ status: 'ready', data: prev.data! }));
      setPendingChanges(false);
      lastSaveRef.current = Date.now();
    } catch (error) {
      setState((prev) => ({
        status: 'error',
        data: prev.data,
        error: error instanceof Error ? error : new Error('Failed to save canvas'),
      }));
    }
  }, [state.status, state.data, canvasId]);

  // Quick viewport update (bypasses full update flow for performance)
  const updateViewportOnly = useCallback(async (viewport: CanvasViewport) => {
    if (state.status !== 'ready') return;

    // Update local state immediately for responsive UI
    setState((prev) => ({
      status: 'ready',
      data: {
        ...prev.data!,
        canvas: { ...prev.data!.canvas, viewport }
      }
    }));
  }, [state.status]);

  // Block position update (memory-first)
  const updateBlockPosition = useCallback((blockId: string, position: CanvasPosition) => {
    // Check if it's a table block (starts with 'table-')
    if (blockId.startsWith('table-')) {
      setInMemoryTableBlocks(prev => {
        const block = prev.get(blockId);
        if (!block) {
          console.warn('📍 Table block not found for position update:', blockId);
          return prev;
        }
        const updated = new Map(prev);
        updated.set(blockId, { ...block, position });
        return updated;
      });
    } else {
      // Datasource block
      setInMemoryBlocks(prev => {
        const block = prev.get(blockId);
        if (!block) {
          console.warn('📍 Block not found for position update:', blockId);
          return prev;
        }
        const updated = new Map(prev);
        updated.set(blockId, { ...block, position });
        return updated;
      });
    }
    
    setHasUnsavedChanges(true);
    setPendingChanges(true);
    debouncedSave();
  }, [debouncedSave]);

  // Create block
  const createBlock = useCallback(async (block: Omit<CanvasBlock, 'id' | 'canvasId' | 'createdAt' | 'updatedAt'>) => {
    console.log('🟪 createBlock called with:', block);
    console.log('🟪 Current canvas state:', state.status);
    console.log('🟪 Current block count:', state.data?.blocks?.length || 0);
    
    if (state.status !== 'ready') {
      const errorMsg = `Cannot create block - canvas state is ${state.status}`;
      console.error('🔥', errorMsg);
      throw new Error(errorMsg);
    }
    
    const newBlock: Partial<CanvasBlock> = {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      canvasId,
      ...block,
    };
    
    console.log('🟪 Generated block with ID:', newBlock.id);
    console.log('🟪 Complete block object:', newBlock);

    try {
      console.log('🟪 Calling updateCanvas with blocks:', [newBlock]);
      await updateCanvas({
        blocks: [newBlock],
      });
      console.log('✅ createBlock completed successfully - block should now exist');
    } catch (error) {
      console.error('🔥 createBlock failed:', error);
      console.error('🔥 Error details:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }, [canvasId, updateCanvas, state.status, state.data]);

  // Load on mount
  useEffect(() => {
    if (state.status === 'idle') {
      void loadCanvas();
    }
  }, [loadCanvas, state.status]);

  // Create relationship (memory-first)
  const createRelationship = useCallback((relationship: Omit<CanvasRelationship, 'id' | 'canvasId' | 'createdAt' | 'updatedAt'>) => {
    console.log('🔷 createRelationship called with:', {
      sourceHandle: relationship.sourceHandle,
      targetHandle: relationship.targetHandle,
      sourceTableId: relationship.sourceTableId,
      targetTableId: relationship.targetTableId
    });
    
    const newRel: CanvasRelationship = {
      ...relationship,
      id: `rel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      canvasId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    console.log('🔷 newRel created:', {
      id: newRel.id,
      sourceHandle: newRel.sourceHandle,
      targetHandle: newRel.targetHandle
    });
    
    setInMemoryRelationships(prev => {
      const updated = new Map(prev);
      updated.set(newRel.id, newRel);
      return updated;
    });
    setHasUnsavedChanges(true);
    setPendingChanges(true);
    debouncedSave();
  }, [canvasId, debouncedSave]);

  // Delete relationship (memory-first)
  const deleteRelationship = useCallback((relationshipId: string) => {
    console.log('🗑️ deleteRelationship called for:', relationshipId);
    
    setInMemoryRelationships(prev => {
      const updated = new Map(prev);
      const existed = updated.has(relationshipId);
      updated.delete(relationshipId);
      console.log('🗑️ Relationship deleted from memory:', { relationshipId, existed, remainingCount: updated.size });
      return updated;
    });
    setHasUnsavedChanges(true);
    setPendingChanges(true);
    debouncedSave();
  }, [debouncedSave]);

  // Delete block (memory-first)
  const deleteBlock = useCallback(async (blockId: string, sourceId: string) => {
    console.log('🗑️ Deleting block from frontend:', { blockId, sourceId });
    
    // Remove from in-memory state immediately
    setInMemoryBlocks(prev => {
      const updated = new Map(prev);
      updated.delete(blockId);
      return updated;
    });
    
    // Also remove any relationships involving this source
    setInMemoryRelationships(prev => {
      const updated = new Map(prev);
      for (const [id, rel] of prev.entries()) {
        if (rel.sourceId === sourceId || rel.targetId === sourceId) {
          updated.delete(id);
        }
      }
      return updated;
    });
    
    // Call backend to delete from database
    try {
      const response = await window.semantiqa?.api.invoke(
        IPC_CHANNELS.CANVAS_DELETE_BLOCK,
        { canvasId, blockId, sourceId }
      );
      
      if (response?.success) {
        console.log('✅ Block deleted successfully from database');
      } else {
        console.error('❌ Failed to delete block from database');
      }
    } catch (error) {
      console.error('❌ Error deleting block:', error);
    }
  }, [canvasId]);

  // Cleanup auto-save timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  return useMemo(() => ({
    data: state.data,
    status: state.status,
    error: state.status === 'error' ? state.error : null,
    refresh: loadCanvas,
    updateCanvas,
    updateBlockPosition,
    createBlock,
    deleteBlock,
    createRelationship,
    deleteRelationship,
    saveNow: saveAllToDatabase,
    hasUnsavedChanges,
    isSaving: state.status === 'saving',
    pendingChanges,
  }), [
    state,
    loadCanvas,
    updateCanvas,
    updateBlockPosition,
    createBlock,
    deleteBlock,
    createRelationship,
    deleteRelationship,
    saveAllToDatabase,
    hasUnsavedChanges,
    pendingChanges,
  ]);
}