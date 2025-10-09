import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ExplorerSnapshot, GraphEdge, GraphGetRequest, GraphGetResponse, GraphNode } from '@semantiqa/contracts';
import { IPC_CHANNELS } from '@semantiqa/app-config';
import { useExplorerState } from './state/useExplorerState';

export type ExplorerSnapshotState =
  | { status: 'idle'; snapshot: null }
  | { status: 'loading'; snapshot: ExplorerSnapshot | null }
  | { status: 'ready'; snapshot: ExplorerSnapshot }
  | { status: 'error'; snapshot: ExplorerSnapshot | null; error: Error };

export function useExplorerSnapshot() {
  const [state, setState] = useState<ExplorerSnapshotState>({ status: 'idle', snapshot: null });
  const { actions } = useExplorerState();
  const loadSnapshot = useCallback(async () => {
    setState((prev) => ({ status: 'loading', snapshot: prev.snapshot }));

    try {
      const request: GraphGetRequest = { filter: { scope: 'schema' } };
      const response = (await window.semantiqa?.api.invoke(IPC_CHANNELS.GRAPH_GET, request)) as
        | GraphGetResponse
        | undefined;

      if (!response) {
        throw new Error('Failed to load explorer snapshot');
      }

      const snapshot = transformGraph(response.nodes, response.edges ?? []);

      setState({ status: 'ready', snapshot });

    } catch (error) {
      setState((prev) => ({
        status: 'error',
        snapshot: prev.snapshot,
        error: error instanceof Error ? error : new Error('Unknown explorer error'),
      }));
    }
  }, []);

  useEffect(() => {
    const listener = (event: Event) => {
      const customEvent = event as CustomEvent<{ sourceId: string; status: ExplorerSnapshot['sources'][number]['status'] }>;
      const payload = customEvent.detail;
      if (!payload || typeof payload !== 'object' || !payload.sourceId) {
        return;
      }

      actions.updateSourceStatus(payload.sourceId, payload.status);
    };

    window.addEventListener('sources:status', listener as EventListener);

    return () => {
      window.removeEventListener('sources:status', listener as EventListener);
    };
  }, [actions]);

  useEffect(() => {
    if (state.status === 'idle') {
      void loadSnapshot();
    }
  }, [loadSnapshot, state.status]);

  return useMemo(
    () => ({
      state,
      loadSnapshot,
      refresh: loadSnapshot,
    }),
    [state, loadSnapshot],
  );
}

function transformGraph(nodes: GraphNode[], edges: GraphEdge[]): ExplorerSnapshot {
  const parentByChild = new Map<string, string>();
  edges
    .filter((edge) => edge.type === 'CONTAINS' || edge.type === 'HAS_COLUMN' || edge.type === 'HAS_FIELD')
    .forEach((edge) => {
      // src CONTAINS dst, so dst's parent is src
      parentByChild.set(edge.dstId ?? edge.dst_id, edge.srcId ?? edge.src_id);
    });

  const sources = nodes
    .filter((node) => node.type === 'source')
    .map((node) => ({
      id: node.id,
      name: node.props.displayName,
      kind: ((node.props as any).kind ?? 'postgres') as ExplorerSnapshot['sources'][number]['kind'],
      owners: node.props.owners,
      status: mapSourceStatus((node.props as any).status),
      connectionStatus: (node.props as any).connectionStatus ?? 'unknown',
      lastCrawlAt: (node.props as any).lastCrawlAt ?? undefined,
      lastError: (node.props as any).lastError ?? undefined,
      lastConnectedAt: (node.props as any).lastConnectedAt ?? undefined,
      lastConnectionError: (node.props as any).lastConnectionError ?? undefined,
      tags: (node.props as any).tags ?? [],
    }));

  const treeNodes = nodes
    .filter((node) => node.type !== 'source')
    .map((node) => ({
      id: node.id,
      parentId: parentByChild.get(node.id) ?? (node.props as { parentId?: string }).parentId,
      type: mapNodeType(node.type),
      label: node.props.displayName ?? node.props.name ?? node.id,
      meta: node.props,
      hasChildren: Boolean((node.props as { hasChildren?: boolean }).hasChildren),
    }));

  return {
    sources,
    nodes: treeNodes,
    fetchedAt: new Date().toISOString(),
  } satisfies ExplorerSnapshot;
}

function mapNodeType(type: GraphNode['type']): ExplorerSnapshot['nodes'][number]['type'] {
  switch (type) {
    case 'schema':
    case 'table':
    case 'view':
    case 'collection':
      return type;
    case 'column':
    case 'field':
      return 'field';
    default:
      return 'schema';
  }
}

function mapSourceStatus(status: unknown): ExplorerSnapshot['sources'][number]['status'] {
  if (status === 'crawling') {
    return 'crawling';
  }
  if (status === 'crawled') {
    return 'crawled';
  }
  if (status === 'error') {
    return 'error';
  }
  if (status === 'not_crawled') {
    return 'not_crawled';
  }

  return 'not_crawled';
}
