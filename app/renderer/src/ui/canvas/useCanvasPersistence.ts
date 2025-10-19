import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  CanvasRelationship,
  CanvasViewport,
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
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSaveRef = useRef<number>(0);

  // Load canvas data
  const loadCanvas = useCallback(async () => {
    setState((prev) => ({ status: 'loading', data: prev.data }));

    try {
      const request: CanvasGetRequest = {
        canvasId,
        includeBlocks: true,
        includeRelationships: true,
      };

      const response = (await window.semantiqa?.api.invoke(
        IPC_CHANNELS.CANVAS_GET,
        request
      )) as CanvasGetResponse | undefined;

      if (!response) {
        throw new Error('Failed to load canvas data');
      }

      const data: CanvasData = {
        canvas: response.canvas,
        blocks: response.blocks,
        relationships: response.relationships,
      };

      setState({ status: 'ready', data });
      setPendingChanges(false);
    } catch (error) {
      setState((prev) => ({
        status: 'error',
        data: prev.data,
        error: error instanceof Error ? error : new Error('Unknown canvas error'),
      }));
    }
  }, [canvasId]);

  // Update canvas data
  const updateCanvas = useCallback(async (updates: {
    canvas?: Partial<CanvasState>;
    blocks?: Partial<CanvasBlock>[];
    relationships?: Partial<CanvasRelationship>[];
    skipAutoSave?: boolean;
  }) => {
    if (state.status !== 'ready') return;

    try {
      const request: CanvasUpdateRequest = {
        canvasId,
        canvas: updates.canvas,
        blocks: updates.blocks?.map(block => ({ id: block.id || '', ...block })),
        relationships: updates.relationships?.map(rel => ({ id: rel.id || '', ...rel })),
      };

      const response = (await window.semantiqa?.api.invoke(
        IPC_CHANNELS.CANVAS_UPDATE,
        request
      )) as CanvasUpdateResponse | undefined;

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

  // Block position update (bypasses full update for drag performance)
  const updateBlockPositionOnly = useCallback(async (blockId: string, position: { x: number; y: number }) => {
    if (state.status !== 'ready') return;

    // Update local state immediately for responsive drag
    setState((prev) => ({
      status: 'ready',
      data: {
        ...prev.data!,
        blocks: prev.data!.blocks.map(block =>
          block.id === blockId ? { ...block, position } : block
        )
      }
    }));
  }, [state.status]);

  // Create block
  const createBlock = useCallback(async (block: Omit<CanvasBlock, 'id' | 'canvasId' | 'createdAt' | 'updatedAt'>) => {
    const newBlock: Partial<CanvasBlock> = {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      canvasId,
      ...block,
    };

    await updateCanvas({
      blocks: [newBlock],
    });
  }, [canvasId, updateCanvas]);

  // Delete block
  const deleteBlock = useCallback(async (blockId: string) => {
    if (state.status !== 'ready') return;

    // Remove from local state immediately
    setState((prev) => ({
      status: 'ready',
      data: {
        ...prev.data!,
        blocks: prev.data!.blocks.filter(block => block.id !== blockId),
        relationships: prev.data!.relationships.filter(
          rel => rel.sourceBlockId !== blockId && rel.targetBlockId !== blockId
        )
      }
    }));

    setPendingChanges(true);
  }, [state.status]);

  // Create relationship
  const createRelationship = useCallback(async (relationship: Omit<CanvasRelationship, 'id' | 'canvasId' | 'createdAt' | 'updatedAt'>) => {
    const newRelationship: Partial<CanvasRelationship> = {
      id: `rel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      canvasId,
      ...relationship,
    };

    await updateCanvas({
      relationships: [newRelationship],
    });
  }, [canvasId, updateCanvas]);

  // Delete relationship
  const deleteRelationship = useCallback(async (relationshipId: string) => {
    if (state.status !== 'ready') return;

    // Remove from local state immediately
    setState((prev) => ({
      status: 'ready',
      data: {
        ...prev.data!,
        relationships: prev.data!.relationships.filter(rel => rel.id !== relationshipId)
      }
    }));

    setPendingChanges(true);
  }, [state.status]);

  // Load on mount
  useEffect(() => {
    if (state.status === 'idle') {
      void loadCanvas();
    }
  }, [loadCanvas, state.status]);

  // Cleanup auto-save timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  return useMemo(() => ({
    state,
    data: state.data,
    isLoading: state.status === 'loading',
    isReady: state.status === 'ready',
    isSaving: state.status === 'saving',
    isError: state.status === 'error',
    error: state.status === 'error' ? state.error : null,
    pendingChanges,
    lastSave: lastSaveRef.current,
    
    // Actions
    loadCanvas,
    updateCanvas,
    saveCanvas,
    updateViewportOnly,
    updateBlockPositionOnly,
    createBlock,
    deleteBlock,
    createRelationship,
    deleteRelationship,
    refresh: loadCanvas,
  }), [
    state,
    pendingChanges,
    loadCanvas,
    updateCanvas,
    saveCanvas,
    updateViewportOnly,
    updateBlockPositionOnly,
    createBlock,
    deleteBlock,
    createRelationship,
    deleteRelationship,
  ]);
}