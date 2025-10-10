import { memo, useMemo } from 'react';
import type { ExplorerSource } from '@semantiqa/contracts';
import { deriveStageFromCrawlStatus, type RuntimeSourceStatus } from './state/useExplorerState';
import './SourceStatusPanel.css';

interface SourceStatusPanelProps {
  sources: ExplorerSource[];
  runtimeStatuses: Map<string, RuntimeSourceStatus>;
  onRetry: (sourceId: string) => void;
}

export const SourceStatusPanel = memo(function SourceStatusPanel({ sources, runtimeStatuses, onRetry }: SourceStatusPanelProps) {
  const items = useMemo(() => {
    return sources.map((source) => {
      const runtime = runtimeStatuses.get(source.id);
      const crawl = runtime?.crawl;
      const connection = runtime?.connection;

      const crawlStage = crawl?.stage ?? deriveStageFromCrawlStatus(source.status);
      const crawlStatusLabel = formatCrawlStatus(crawl?.status ?? source.status, crawlStage);
      const connectionStatusLabel = formatConnectionStatus(
        connection?.status ?? source.connectionStatus,
        connection?.error?.message ?? source.lastConnectionError,
      );

      return {
        id: source.id,
        name: source.name,
        kind: source.kind,
        crawlStage,
        crawlStatusLabel,
        crawlError: crawl?.error?.message ?? source.lastError,
        lastCrawlAt: crawl?.updatedAt ? new Date(crawl.updatedAt).toLocaleString() : source.lastCrawlAt,
        connectionStatusLabel,
        connectionError: connection?.error?.message ?? source.lastConnectionError,
        lastConnectedAt: connection?.updatedAt
          ? new Date(connection.updatedAt).toLocaleString()
          : source.lastConnectedAt,
      } satisfies SourceStatusItem;
    });
  }, [runtimeStatuses, sources]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="source-status-panel">
      <header>
        <span>Status overview</span>
      </header>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <div className="source-status-panel__indicator">
              <span className={`source-status-panel__badge source-status-panel__badge--${item.crawlStage}`}>
                {item.crawlStatusLabel}
              </span>
              <span className="source-status-panel__name">{item.name}</span>
              <span className="source-status-panel__kind">{item.kind.toUpperCase()}</span>
            </div>
            <dl>
              <div>
                <dt>Last crawl</dt>
                <dd>{item.lastCrawlAt ? item.lastCrawlAt : 'Not yet crawled'}</dd>
              </div>
              <div>
                <dt>Last crawl error</dt>
                <dd>{item.crawlError ?? '—'}</dd>
              </div>
              <div>
                <dt>Connection</dt>
                <dd>{item.connectionStatusLabel}</dd>
              </div>
              <div>
                <dt>Last connection error</dt>
                <dd>{item.connectionError ?? '—'}</dd>
              </div>
            </dl>
            <div className="source-status-panel__actions">
              <button type="button" onClick={() => onRetry(item.id)}>
                Retry crawl
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
});

interface SourceStatusItem {
  id: string;
  name: string;
  kind: ExplorerSource['kind'];
  crawlStage: ReturnType<typeof deriveStageFromCrawlStatus>;
  crawlStatusLabel: string;
  crawlError?: string | null;
  lastCrawlAt?: string | null;
  connectionStatusLabel: string;
  connectionError?: string | null;
  lastConnectedAt?: string | null;
}

function formatCrawlStatus(status: ExplorerSource['status'], stage: string): string {
  switch (stage) {
    case 'queued':
      return 'Queued';
    case 'running':
      return 'Crawling';
    case 'completed':
      return 'Crawled';
    case 'failed':
      return status === 'error' ? 'Failed' : 'Needs attention';
    default:
      return status;
  }
}

function formatConnectionStatus(
  status: ExplorerSource['connectionStatus'],
  errorMessage?: string | null,
): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'checking':
      return 'Checking';
    case 'error':
      return errorMessage ? `Needs attention — ${errorMessage}` : 'Needs attention';
    case 'unknown':
    default:
      return 'Unknown';
  }
}
