import { createContext, createElement, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import type { ExplorerSnapshot } from '@semantiqa/contracts';

interface ExplorerState {
  snapshot: ExplorerSnapshot;
  expandedNodeIds: Set<string>;
  selectedNodeId: string | null;
  isConnectSourceOpen: boolean;
  wizardStep: 'choose-kind' | 'configure' | 'review';
  selectedKind: 'postgres' | 'mysql' | 'mongo' | 'duckdb' | null;
}

type ExplorerAction =
  | { type: 'INGEST_SNAPSHOT'; snapshot: ExplorerSnapshot }
  | { type: 'TOGGLE_NODE'; nodeId: string }
  | { type: 'SELECT_NODE'; nodeId: string | null }
  | { type: 'OPEN_CONNECT_SOURCE' }
  | { type: 'CLOSE_CONNECT_SOURCE' }
  | { type: 'SELECT_SOURCE_KIND'; kind: 'postgres' | 'mysql' | 'mongo' | 'duckdb' }
  | { type: 'GO_TO_REVIEW' }
  | { type: 'RESET_CONNECT_WIZARD' };

const initialState: ExplorerState = {
  snapshot: {
    sources: [],
    nodes: [],
    fetchedAt: new Date(0).toISOString(),
  },
  expandedNodeIds: new Set<string>(),
  selectedNodeId: null,
  isConnectSourceOpen: false,
  wizardStep: 'choose-kind',
  selectedKind: null,
};

function reducer(state: ExplorerState, action: ExplorerAction): ExplorerState {
  switch (action.type) {
    case 'INGEST_SNAPSHOT': {
      const mergedSnapshot = mergeSnapshotWithStatus(action.snapshot, state.sourceStatuses);
      return {
        snapshot: mergedSnapshot,
        expandedNodeIds: new Set(action.snapshot.sources.map((source) => source.id)),
        selectedNodeId: state.selectedNodeId,
        isConnectSourceOpen: state.isConnectSourceOpen,
        wizardStep: state.wizardStep,
        selectedKind: state.selectedKind,
        sourceStatuses: state.sourceStatuses,
      };
    }
    case 'TOGGLE_NODE': {
      const expanded = new Set(state.expandedNodeIds);
      if (expanded.has(action.nodeId)) {
        expanded.delete(action.nodeId);
      } else {
        expanded.add(action.nodeId);
      }
      return { ...state, expandedNodeIds: expanded };
    }
    case 'SELECT_NODE':
      return { ...state, selectedNodeId: action.nodeId };
    case 'OPEN_CONNECT_SOURCE':
      return { ...state, isConnectSourceOpen: true, wizardStep: 'choose-kind', selectedKind: null };
    case 'CLOSE_CONNECT_SOURCE':
      return { ...state, isConnectSourceOpen: false, wizardStep: 'choose-kind', selectedKind: null };
    case 'SELECT_SOURCE_KIND':
      return { ...state, selectedKind: action.kind, wizardStep: 'configure' };
    case 'GO_TO_REVIEW':
      return { ...state, wizardStep: 'review' };
    case 'RESET_CONNECT_WIZARD':
      return { ...state, wizardStep: 'choose-kind', selectedKind: null };
    case 'UPDATE_SOURCE_STATUS': {
      const statuses = new Map(state.sourceStatuses);
      statuses.set(action.sourceId, action.status);

      return {
        ...state,
        sourceStatuses: statuses,
        snapshot: mergeSnapshotWithStatus(state.snapshot, statuses),
      };
    }
    default:
      return state;
  }
}

const ExplorerStateContext = createContext<
  | {
      state: ExplorerState;
      dispatch: React.Dispatch<ExplorerAction>;
    }
  | null
>(null);

export function ExplorerStateProvider({
  children,
  initialSnapshot,
}: {
  children: React.ReactNode;
  initialSnapshot: ExplorerSnapshot | null;
}) {
  const initialRef = useRef(initialSnapshot);
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (initialRef.current) {
      dispatch({ type: 'INGEST_SNAPSHOT', snapshot: initialRef.current });
      initialRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (initialSnapshot) {
      dispatch({ type: 'INGEST_SNAPSHOT', snapshot: initialSnapshot });
    }
  }, [initialSnapshot]);

  // Listen for source status updates from main process
  useEffect(() => {
    const handleStatusUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        sourceId: string;
        status: 'connecting' | 'queued' | 'ready' | 'error' | 'needs_attention';
      }>;
      if (customEvent.detail) {
        dispatch({
          type: 'UPDATE_SOURCE_STATUS',
          sourceId: customEvent.detail.sourceId,
          status: customEvent.detail.status,
        });
      }
    };

    window.addEventListener('sources:status', handleStatusUpdate);
    return () => {
      window.removeEventListener('sources:status', handleStatusUpdate);
    };
  }, []);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return createElement(ExplorerStateContext.Provider, { value }, children);
}

export function useExplorerState() {
  const context = useContext(ExplorerStateContext);
  if (!context) {
    throw new Error('useExplorerState must be used within ExplorerStateProvider');
  }

  const { state, dispatch } = context;
  const actions = useMemo(
    () => ({
      ingestSnapshot: (snapshot: ExplorerSnapshot) => dispatch({ type: 'INGEST_SNAPSHOT', snapshot }),
      toggleNode: (nodeId: string) => dispatch({ type: 'TOGGLE_NODE', nodeId }),
      selectNode: (nodeId: string | null) => dispatch({ type: 'SELECT_NODE', nodeId }),
      openConnectSource: () => dispatch({ type: 'OPEN_CONNECT_SOURCE' }),
      closeConnectSource: () => dispatch({ type: 'CLOSE_CONNECT_SOURCE' }),
      selectSourceKind: (kind: 'postgres' | 'mysql' | 'mongo' | 'duckdb') =>
        dispatch({ type: 'SELECT_SOURCE_KIND', kind }),
      advanceToReview: () => dispatch({ type: 'GO_TO_REVIEW' }),
      resetConnectWizard: () => dispatch({ type: 'RESET_CONNECT_WIZARD' }),
      updateSourceStatus: (
        sourceId: string,
        status: ExplorerSnapshot['sources'][number]['status'],
      ) => dispatch({ type: 'UPDATE_SOURCE_STATUS', sourceId, status }),
    }),
    [dispatch],
  );

  return {
    snapshot: state.snapshot,
    expandedNodeIds: state.expandedNodeIds,
    selectedNodeId: state.selectedNodeId,
    isConnectSourceOpen: state.isConnectSourceOpen,
    wizardStep: state.wizardStep,
    selectedKind: state.selectedKind,
    actions,
  };
}

function mergeSnapshotWithStatus(
  snapshot: ExplorerSnapshot,
  statuses: Map<string, ExplorerSnapshot['sources'][number]['status']>,
): ExplorerSnapshot {
  const mergedSources = snapshot.sources.map((source) => {
    const override = statuses.get(source.id);
    return {
      ...source,
      status: override ?? source.status,
    };
  });

  return {
    ...snapshot,
    sources: mergedSources,
  } satisfies ExplorerSnapshot;
}


