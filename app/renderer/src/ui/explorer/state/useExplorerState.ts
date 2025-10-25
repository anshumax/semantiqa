import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { IPC_CHANNELS } from '@semantiqa/app-config';
import type { ExplorerSnapshot, ExplorerSource, ExplorerTreeNode, TableProfile } from '@semantiqa/contracts';

interface ExplorerState {
  snapshot: ExplorerSnapshot;
  expandedNodeIds: Set<string>;
  selectedNodeId: string | null;
  isConnectSourceOpen: boolean;
  wizardStep: 'choose-kind' | 'configure' | 'review';
  selectedKind: 'postgres' | 'mysql' | 'mongo' | 'duckdb' | null;
  runtimeStatuses: Map<string, RuntimeSourceStatus>;
  inspector: InspectorState;
}

type UiStatus = 'queued' | 'running' | 'ready' | 'error' | 'warning';
type CrawlStage = 'queued' | 'running' | 'completed' | 'failed';

export type CrawlStatusEvent = {
  kind: 'crawl';
  sourceId: string;
  sourceName: string;
  status: UiStatus;
  crawlStatus: ExplorerSnapshot['sources'][number]['status'];
  stage?: CrawlStage;
  error?: { message: string; meta?: Record<string, unknown> };
  updatedAt: number;
};

export type ConnectionStatusEvent = {
  kind: 'connection';
  sourceId: string;
  sourceName: string;
  status: UiStatus;
  connectionStatus: ExplorerSnapshot['sources'][number]['connectionStatus'];
  error?: { message: string; meta?: Record<string, unknown> };
  updatedAt: number;
};

export type SourceStatusEvent = CrawlStatusEvent | ConnectionStatusEvent;

export type RuntimeSourceStatus = {
  crawl?: {
    stage: CrawlStage;
    status: ExplorerSnapshot['sources'][number]['status'];
    error?: { message: string; meta?: Record<string, unknown> };
    updatedAt: number;
  };
  connection?: {
    status: ExplorerSnapshot['sources'][number]['connectionStatus'];
    error?: { message: string; meta?: Record<string, unknown> };
    updatedAt: number;
  };
};

interface InspectorState {
  selectedNode: InspectorNode | null;
  breadcrumbs: Array<{ id: string; label: string }>;
  metadata: InspectorMetadata | null;
  stats: InspectorStats | null;
  lastCrawledAt: string | null;
  lastError: string | null;
}

interface InspectorNode {
  id: string;
  label: string;
  kind: ExplorerTreeNode['type'];
}

interface InspectorMetadata {
  owners: string[];
  tags: string[];
  sensitivity?: string;
  status?: string;
  description?: string;
  kind?: ExplorerSource['kind'];
}

interface InspectorStats {
  columnCount?: number;
  profile?: TableProfile;
}

type ExplorerAction =
  | { type: 'INGEST_SNAPSHOT'; snapshot: ExplorerSnapshot }
  | { type: 'TOGGLE_NODE'; nodeId: string }
  | { type: 'SELECT_NODE'; nodeId: string | null }
  | { type: 'OPEN_CONNECT_SOURCE' }
  | { type: 'CLOSE_CONNECT_SOURCE' }
  | { type: 'SELECT_SOURCE_KIND'; kind: 'postgres' | 'mysql' | 'mongo' | 'duckdb' }
  | { type: 'GO_TO_REVIEW' }
  | { type: 'RESET_CONNECT_WIZARD' }
  | { type: 'ADVANCE_WIZARD'; step: ExplorerState['wizardStep'] }
  | {
      type: 'UPDATE_SOURCE_STATUS';
      sourceId: string;
      payload: SourceStatusEvent;
    };

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
  runtimeStatuses: new Map(),
  inspector: emptyInspectorState(),
};

function reducer(state: ExplorerState, action: ExplorerAction): ExplorerState {
  switch (action.type) {
    case 'INGEST_SNAPSHOT': {
      const mergedSnapshot = mergeSnapshotWithStatus(action.snapshot, state.runtimeStatuses);
      const inspector = buildInspectorState({
        snapshot: mergedSnapshot,
        selectedNodeId: state.selectedNodeId,
      });
      return {
        snapshot: mergedSnapshot,
        expandedNodeIds: new Set(action.snapshot.sources.map((source) => source.id)),
        selectedNodeId: state.selectedNodeId,
        isConnectSourceOpen: state.isConnectSourceOpen,
        wizardStep: state.wizardStep,
        selectedKind: state.selectedKind,
        runtimeStatuses: state.runtimeStatuses,
        inspector,
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
    case 'SELECT_NODE': {
      const inspector = buildInspectorState({ snapshot: state.snapshot, selectedNodeId: action.nodeId });
      return { ...state, selectedNodeId: action.nodeId, inspector };
    }
    case 'OPEN_CONNECT_SOURCE':
      return { ...state, isConnectSourceOpen: true, wizardStep: 'choose-kind', selectedKind: null };
    case 'CLOSE_CONNECT_SOURCE':
      return { ...state, isConnectSourceOpen: false, wizardStep: 'choose-kind', selectedKind: null };
    case 'SELECT_SOURCE_KIND':
      return { ...state, selectedKind: action.kind, wizardStep: 'configure' };
    case 'GO_TO_REVIEW':
      return { ...state, wizardStep: 'review' };
    case 'ADVANCE_WIZARD':
      return { ...state, wizardStep: action.step };
    case 'RESET_CONNECT_WIZARD':
      return { ...state, wizardStep: 'choose-kind', selectedKind: null };
    case 'UPDATE_SOURCE_STATUS': {
      const runtimeStatuses = new Map(state.runtimeStatuses);
      const current = runtimeStatuses.get(action.sourceId) ?? {};

      if (action.payload.kind === 'crawl') {
        runtimeStatuses.set(action.sourceId, {
          ...current,
          crawl: {
            stage: action.payload.stage ?? deriveStageFromCrawlStatus(action.payload.crawlStatus),
            status: action.payload.crawlStatus,
            error: action.payload.error,
            updatedAt: action.payload.updatedAt,
          },
        });
      } else {
        runtimeStatuses.set(action.sourceId, {
          ...current,
          connection: {
            status: action.payload.connectionStatus,
            error: action.payload.error,
            updatedAt: action.payload.updatedAt,
          },
        });
      }

      const mergedSnapshot = mergeSnapshotWithStatus(state.snapshot, runtimeStatuses);

      return {
        ...state,
        runtimeStatuses,
        snapshot: mergedSnapshot,
        inspector: buildInspectorState({ snapshot: mergedSnapshot, selectedNodeId: state.selectedNodeId }),
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
      const detail = (event as CustomEvent<SourceStatusEvent>).detail;
      if (!detail || !detail.sourceId) {
        return;
      }

      dispatch({
        type: 'UPDATE_SOURCE_STATUS',
        sourceId: detail.sourceId,
        payload: detail,
      });
    };

    window.addEventListener('sources:status', handleStatusUpdate as EventListener);
    return () => {
      window.removeEventListener('sources:status', handleStatusUpdate as EventListener);
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
  const retryCrawl = useCallback(async (sourceId: string) => {
    return window.semantiqa?.api.invoke(IPC_CHANNELS.SOURCES_RETRY_CRAWL, { sourceId });
  }, []);
  const crawlAll = useCallback(async () => {
    return window.semantiqa?.api.invoke(IPC_CHANNELS.SOURCES_CRAWL_ALL, undefined as never);
  }, []);

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
      advanceWizardTo: (step: ExplorerState['wizardStep']) => dispatch({ type: 'ADVANCE_WIZARD', step }),
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
    runtimeStatuses: state.runtimeStatuses,
    inspector: state.inspector,
    commands: {
      retryCrawl,
      crawlAll,
    },
  };
}

function mergeSnapshotWithStatus(
  snapshot: ExplorerSnapshot,
  runtimeStatuses: Map<string, RuntimeSourceStatus>,
): ExplorerSnapshot {
  const mergedSources = snapshot.sources.map((source) => {
    const runtime = runtimeStatuses.get(source.id);
    const crawl = runtime?.crawl;
    const connection = runtime?.connection;

    const status = crawl?.status ?? source.status;
    const connectionStatus = connection?.status ?? source.connectionStatus;

    const lastError = crawl?.error?.message ?? (crawl?.stage === 'failed' ? crawl?.error?.message ?? source.lastError : source.lastError);
    const lastCrawlAt = crawl?.stage === 'completed' ? new Date(crawl.updatedAt).toISOString() : source.lastCrawlAt;
    const lastConnectionError = connection?.error?.message ?? source.lastConnectionError;
    const lastConnectedAt = connection?.status === 'connected' ? new Date(connection.updatedAt).toISOString() : source.lastConnectedAt;

    return {
      ...source,
      status,
      connectionStatus,
      lastError,
      lastCrawlAt,
      lastConnectionError,
      lastConnectedAt,
      owners: source.owners ?? [],
      tags: source.tags ?? [],
    } satisfies ExplorerSnapshot['sources'][number];
  });

  return {
    ...snapshot,
    sources: mergedSources,
  } satisfies ExplorerSnapshot;
}

export function deriveStageFromCrawlStatus(status: ExplorerSnapshot['sources'][number]['status']): CrawlStage {
  switch (status) {
    case 'crawled':
      return 'completed';
    case 'crawling':
      return 'running';
    case 'error':
      return 'failed';
    case 'not_crawled':
    default:
      return 'queued';
  }
}

function buildInspectorState(params: {
  snapshot: ExplorerSnapshot;
  selectedNodeId: string | null;
}): InspectorState {
  const { snapshot, selectedNodeId } = params;

  if (!selectedNodeId) {
    return emptyInspectorState();
  }

  const selectedNode = snapshot.nodes.find((node) => node.id === selectedNodeId);

  if (!selectedNode) {
    return emptyInspectorState();
  }

  const breadcrumbs = buildBreadcrumbs(snapshot.nodes, selectedNodeId);
  const source = resolveSourceForNode(snapshot.sources, breadcrumbs);
  const metadata = buildMetadata(selectedNode, source);
  const stats = buildStats(selectedNode);

  return {
    selectedNode: {
      id: selectedNode.id,
      label: selectedNode.label,
      kind: selectedNode.type,
    },
    breadcrumbs,
    metadata,
    stats,
    lastCrawledAt: source?.lastCrawlAt ?? null,
    lastError: source?.lastError ?? source?.lastConnectionError ?? null,
  } satisfies InspectorState;
}

function emptyInspectorState(): InspectorState {
  return {
    selectedNode: null,
    breadcrumbs: [],
    metadata: null,
    stats: null,
    lastCrawledAt: null,
    lastError: null,
  } satisfies InspectorState;
}

function buildBreadcrumbs(nodes: ExplorerTreeNode[], selectedNodeId: string) {
  const breadcrumbs: Array<{ id: string; label: string }> = [];
  let currentId: string | undefined = selectedNodeId;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  while (currentId) {
    const node = nodeById.get(currentId);
    if (!node) {
      break;
    }
    breadcrumbs.unshift({ id: node.id, label: node.label });
    currentId = node.parentId;
  }

  return breadcrumbs;
}

function resolveSourceForNode(
  sources: ExplorerSource[],
  breadcrumbs: Array<{ id: string; label: string }>,
): ExplorerSource | undefined {
  const sourceIds = sources.map((source) => source.id);
  const match = breadcrumbs.find((crumb) => sourceIds.includes(crumb.id));
  if (!match) {
    return undefined;
  }
  return sources.find((source) => source.id === match.id);
}

function buildMetadata(node: ExplorerTreeNode, source?: ExplorerSource): InspectorMetadata | null {
  const owners = source?.owners ?? [];
  const nodeTags = Array.isArray((node.meta as { tags?: unknown }).tags)
    ? ((node.meta as { tags?: string[] }).tags ?? [])
    : [];
  const tags = nodeTags.length > 0 ? nodeTags : Array.isArray(source?.tags) ? source.tags : [];
  const description = (node.meta as { description?: string }).description ?? source?.description;

  if (!owners.length && !tags.length && !description) {
    return null;
  }

  return {
    owners,
    tags,
    description,
    sensitivity: (node.meta as { sensitivity?: string }).sensitivity,
    status: (node.meta as { status?: string }).status,
    kind: source?.kind,
  } satisfies InspectorMetadata;
}

function buildStats(node: ExplorerTreeNode): InspectorStats | null {
  const meta = node.meta as { profile?: TableProfile; columnCount?: number; stats?: { columnCount?: number } };

  if (!meta) {
    return null;
  }

  const columnCount = meta.columnCount ?? meta.stats?.columnCount;
  const profile = meta.profile;
  const hasProfile = Boolean(meta.profile);
  const hasCounts = typeof columnCount === 'number';

  if (!hasProfile && !hasCounts) {
    return null;
  }

  return {
    columnCount,
    profile,
  } satisfies InspectorStats;
}


