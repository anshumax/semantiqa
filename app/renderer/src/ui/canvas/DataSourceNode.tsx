import React, { useMemo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import './DataSourceNode.css';

export type DataSourceKind = 'postgres' | 'mysql' | 'mongo' | 'duckdb';
export type ConnectionStatus = 'unknown' | 'checking' | 'connected' | 'error';
export type CrawlStatus = 'not_crawled' | 'crawling' | 'crawled' | 'error';

export interface DataSourceNodeData {
  id: string;
  name: string;
  kind: DataSourceKind;
  connectionStatus: ConnectionStatus;
  crawlStatus: CrawlStatus;
  databaseName?: string;
  lastError?: string;
  tableCount?: number;
  lastCrawlAt?: string;
}

export function DataSourceNode({ data, selected }: NodeProps<DataSourceNodeData>) {
  // Get icon and color theme for data source kind
  const sourceTheme = useMemo(() => {
    switch (data.kind) {
      case 'postgres':
        return {
          icon: '🐘',
          primaryColor: 'rgba(51, 103, 145, 0.3)',
          borderColor: '#336791',
        };
      case 'mysql':
        return {
          icon: '🐬',
          primaryColor: 'rgba(0, 84, 107, 0.3)',
          borderColor: '#00758F',
        };
      case 'mongo':
        return {
          icon: '🍃',
          primaryColor: 'rgba(77, 179, 61, 0.3)',
          borderColor: '#4DB33D',
        };
      case 'duckdb':
        return {
          icon: '🦆',
          primaryColor: 'rgba(255, 165, 0, 0.3)',
          borderColor: '#FFA500',
        };
      default:
        return {
          icon: '📊',
          primaryColor: 'rgba(107, 114, 128, 0.3)',
          borderColor: '#6B7280',
        };
    }
  }, [data.kind]);

  // Get status class for border styling
  const statusClass = useMemo(() => {
    if (data.connectionStatus === 'error' || data.crawlStatus === 'error') {
      return 'data-source-node--error';
    } else if (data.connectionStatus === 'checking' || data.crawlStatus === 'crawling') {
      return 'data-source-node--checking';
    } else if (data.connectionStatus === 'connected' && data.crawlStatus === 'crawled') {
      return 'data-source-node--ready';
    } else if (data.connectionStatus === 'connected') {
      return 'data-source-node--connected';
    } else {
      return 'data-source-node--unknown';
    }
  }, [data.connectionStatus, data.crawlStatus]);

  return (
    <div 
      className={`data-source-node ${statusClass} ${selected ? 'data-source-node--selected' : ''}`}
      style={{
        background: sourceTheme.primaryColor,
      }}
    >
      {/* Connection handles on all sides */}
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Top} id="top-source" />
      
      <Handle type="target" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Right} id="right-source" />
      
      <Handle type="target" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" />
      
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Left} id="left-source" />

      {/* Header with icon and kind */}
      <div className="data-source-node__header">
        <span className="data-source-node__icon" title={data.kind}>
          {sourceTheme.icon}
        </span>
        <span className="data-source-node__kind">{data.kind.toUpperCase()}</span>
      </div>

      {/* Connection name */}
      <div className="data-source-node__title" title={data.name}>
        {data.name}
      </div>

      {/* Database name if available */}
      {data.databaseName && (
        <div className="data-source-node__subtitle" title={`Database: ${data.databaseName}`}>
          {data.databaseName}
        </div>
      )}

      {/* Table count if available */}
      {data.tableCount !== undefined && (
        <div className="data-source-node__meta">
          {data.tableCount} {data.tableCount === 1 ? 'table' : 'tables'}
        </div>
      )}

      {/* Error message if in error state */}
      {(data.connectionStatus === 'error' || data.crawlStatus === 'error') && 
       data.lastError && (
        <div className="data-source-node__error" title={data.lastError}>
          ⚠️ Error
        </div>
      )}
    </div>
  );
}
