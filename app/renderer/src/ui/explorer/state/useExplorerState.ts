import { createContext, createElement, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import type { ExplorerSnapshot } from '@semantiqa/contracts';

interface ExplorerState {
  snapshot: ExplorerSnapshot;
  expandedNodeIds: Set<string>;
  selectedNodeId: string | null;
}

type ExplorerAction =
  | { type: 'INGEST_SNAPSHOT'; snapshot: ExplorerSnapshot }
  | { type: 'TOGGLE_NODE'; nodeId: string }
  | { type: 'SELECT_NODE'; nodeId: string | null };

const initialState: ExplorerState = {
  snapshot: {
    sources: [],
    nodes: [],
    fetchedAt: new Date(0).toISOString(),
  },
  expandedNodeIds: new Set<string>(),
  selectedNodeId: null,
};

function reducer(state: ExplorerState, action: ExplorerAction): ExplorerState {
  switch (action.type) {
    case 'INGEST_SNAPSHOT':
      return {
        snapshot: action.snapshot,
        expandedNodeIds: new Set(action.snapshot.sources.map((source) => source.id)),
        selectedNodeId: state.selectedNodeId,
      };
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
    }),
    [dispatch],
  );

  return {
    snapshot: state.snapshot,
    expandedNodeIds: state.expandedNodeIds,
    selectedNodeId: state.selectedNodeId,
    actions,
  };
}


