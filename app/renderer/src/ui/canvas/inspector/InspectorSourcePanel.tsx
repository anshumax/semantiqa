import { useState, useEffect, useCallback } from 'react';
import { InspectorHeader } from './InspectorHeader';
import { Tooltip } from '../../components/Tooltip';
import { IPC_CHANNELS } from '@semantiqa/app-config';
import './InspectorSourcePanel.css';

interface SourceDetails {
  sourceId: string;
  name: string;
  kind: 'postgres' | 'mysql' | 'mongo' | 'duckdb';
  databaseName?: string;
  connectionStatus: 'unknown' | 'checking' | 'connected' | 'error';
  crawlStatus: 'not_crawled' | 'crawling' | 'crawled' | 'error';
  lastConnectedAt?: string;
  lastCrawlAt?: string;
  lastError?: string;
  statistics: {
    tableCount: number;
    totalColumns: number;
    totalRows?: number;
    schemas?: Array<{ name: string; tableCount: number }>;
    topTables?: Array<{ name: string; rowCount: number; columnCount: number }>;
  };
}

export interface InspectorSourcePanelProps {
  sourceId: string;
  onClose: () => void;
}

export function InspectorSourcePanel({ sourceId, onClose }: InspectorSourcePanelProps) {
  const [details, setDetails] = useState<SourceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch source details
  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await window.semantiqa?.api.invoke(
          IPC_CHANNELS.SOURCES_GET_DETAILS,
          { sourceId }
        );
        
        if ('code' in response) {
          setError(response.message || 'Failed to load source details');
          setDetails(null);
        } else {
          setDetails(response);
        }
      } catch (err) {
        console.error('Error fetching source details:', err);
        setError('Failed to load source details');
        setDetails(null);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [sourceId]);

  // Subscribe to real-time status updates
  useEffect(() => {
    const handleStatusUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail.sourceId === sourceId && details) {
        setDetails(prev => prev ? {
          ...prev,
          connectionStatus: detail.connectionStatus || prev.connectionStatus,
          crawlStatus: detail.status || prev.crawlStatus,
        } : null);
      }
    };
    
    window.addEventListener('sources:status', handleStatusUpdate as EventListener);
    return () => window.removeEventListener('sources:status', handleStatusUpdate as EventListener);
  }, [sourceId, details]);

  const handleRetryCrawl = useCallback(async () => {
    try {
      await window.semantiqa?.api.invoke(IPC_CHANNELS.SOURCES_RETRY_CRAWL, { sourceId });
    } catch (err) {
      console.error('Failed to retry crawl:', err);
    }
  }, [sourceId]);

  const getKindIcon = (kind: string) => {
    switch (kind) {
      case 'postgres': return '🐘';
      case 'mysql': return '🐬';
      case 'mongo': return '🍃';
      case 'duckdb': return '🦆';
      default: return '📊';
    }
  };

  const getStatusBadge = () => {
    if (!details) return undefined;
    
    if (details.connectionStatus === 'error' || details.crawlStatus === 'error') {
      return { text: 'Error', status: 'error' as const };
    } else if (details.crawlStatus === 'crawling') {
      return { text: 'Crawling', status: 'info' as const };
    } else if (details.connectionStatus === 'connected' && details.crawlStatus === 'crawled') {
      return { text: 'Ready', status: 'success' as const };
    } else if (details.connectionStatus === 'connected') {
      return { text: 'Connected', status: 'info' as const };
    }
    return { text: 'Unknown', status: 'warning' as const };
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const formatNumber = (num?: number) => {
    if (num === undefined || num === null) return '—';
    return num.toLocaleString();
  };

  if (loading) {
    return (
      <div className="inspector-source-panel">
        <InspectorHeader 
          icon="📊" 
          title="Loading..." 
          onClose={onClose}
        />
        <div className="inspector-source-panel__loading">
          <div className="spinner"></div>
          <p>Loading source details...</p>
        </div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="inspector-source-panel">
        <InspectorHeader 
          icon="⚠️" 
          title="Error" 
          onClose={onClose}
        />
        <div className="inspector-source-panel__error">
          <p>{error || 'Source not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="inspector-source-panel">
      <InspectorHeader
        icon={getKindIcon(details.kind)}
        title={details.name}
        subtitle={details.kind.toUpperCase()}
        badge={getStatusBadge()}
        onClose={onClose}
      />

      <div className="inspector-source-panel__content">
        {/* Metadata Section */}
        <section className="inspector-section">
          <h3 className="inspector-section__title">Metadata</h3>
          <dl className="inspector-section__list">
            <div className="inspector-section__row">
              <dt>Database</dt>
              <dd>{details.databaseName || '—'}</dd>
            </div>
            <div className="inspector-section__row">
              <dt>Type</dt>
              <dd>{details.kind}</dd>
            </div>
          </dl>
        </section>

        {/* Connection Section */}
        <section className="inspector-section">
          <h3 className="inspector-section__title">Connection</h3>
          <dl className="inspector-section__list">
            <div className="inspector-section__row">
              <dt>Status</dt>
              <dd>
                <span className={`inspector-status inspector-status--${details.connectionStatus}`}>
                  {details.connectionStatus}
                </span>
              </dd>
            </div>
            <div className="inspector-section__row">
              <dt>Last Connected</dt>
              <dd>{formatDate(details.lastConnectedAt)}</dd>
            </div>
          </dl>
        </section>

        {/* Crawl Section */}
        <section className="inspector-section">
          <h3 className="inspector-section__title">Schema Crawl</h3>
          <dl className="inspector-section__list">
            <div className="inspector-section__row">
              <dt>Status</dt>
              <dd>
                <span className={`inspector-status inspector-status--${details.crawlStatus}`}>
                  {details.crawlStatus.replace('_', ' ')}
                </span>
              </dd>
            </div>
            <div className="inspector-section__row">
              <dt>Last Crawl</dt>
              <dd>{formatDate(details.lastCrawlAt)}</dd>
            </div>
            {details.lastError && (
              <div className="inspector-section__row inspector-section__row--error">
                <dt>Error</dt>
                <dd>{details.lastError}</dd>
              </div>
            )}
          </dl>
        </section>

        {/* Statistics Section */}
        <section className="inspector-section">
          <h3 className="inspector-section__title">Statistics</h3>
          <dl className="inspector-section__list">
            <div className="inspector-section__row">
              <dt>Tables</dt>
              <dd className="inspector-section__value--large">{formatNumber(details.statistics.tableCount)}</dd>
            </div>
            <div className="inspector-section__row">
              <dt>Columns</dt>
              <dd className="inspector-section__value--large">{formatNumber(details.statistics.totalColumns)}</dd>
            </div>
            <div className="inspector-section__row">
              <dt>Total Rows</dt>
              <dd className="inspector-section__value--large">
                {details.statistics.totalRows !== null && details.statistics.totalRows !== undefined ? (
                  formatNumber(details.statistics.totalRows)
                ) : (
                  <Tooltip content="Row count unavailable. Database user may need elevated permissions to access statistics tables (pg_stat_user_tables, information_schema.TABLES, etc).">
                    <span className="unavailable-stat">
                      <span>Unknown</span>
                      <span className="info-icon">ⓘ</span>
                    </span>
                  </Tooltip>
                )}
              </dd>
            </div>
          </dl>

          {/* Schemas breakdown */}
          {details.statistics.schemas && details.statistics.schemas.length > 0 && (
            <div className="inspector-subsection">
              <h4 className="inspector-subsection__title">Schemas</h4>
              <ul className="inspector-subsection__list">
                {details.statistics.schemas.map(schema => (
                  <li key={schema.name} className="inspector-subsection__item">
                    <span className="inspector-subsection__name">{schema.name}</span>
                    <span className="inspector-subsection__count">{schema.tableCount} tables</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Top tables */}
          {details.statistics.topTables && details.statistics.topTables.length > 0 && (
            <div className="inspector-subsection">
              <h4 className="inspector-subsection__title">Largest Tables</h4>
              <ul className="inspector-subsection__list">
                {details.statistics.topTables.map(table => (
                  <li key={table.name} className="inspector-subsection__item">
                    <span className="inspector-subsection__name">{table.name}</span>
                    <span className="inspector-subsection__meta">
                      {formatNumber(table.rowCount)} rows · {table.columnCount} cols
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Actions Section */}
        <section className="inspector-section inspector-section--actions">
          <button
            type="button"
            className="inspector-action-button inspector-action-button--primary"
            onClick={handleRetryCrawl}
            disabled={details.crawlStatus === 'crawling'}
          >
            {details.crawlStatus === 'crawling' ? 'Crawling...' : 'Retry Crawl'}
          </button>
        </section>
      </div>
    </div>
  );
}

