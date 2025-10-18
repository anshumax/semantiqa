import React, { useState, useCallback, useRef, useMemo } from 'react';
import { CanvasPosition, CanvasSize } from './types';
import './CanvasBlock.css';

export type DataSourceKind = 'postgres' | 'mysql' | 'mongo' | 'duckdb';
export type ConnectionStatus = 'unknown' | 'checking' | 'connected' | 'error';
export type CrawlStatus = 'not_crawled' | 'crawling' | 'crawled' | 'error';

export interface DataSourceInfo {
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

export interface CanvasBlockProps {
  id: string;
  position: CanvasPosition;
  size?: CanvasSize;
  dataSource: DataSourceInfo;
  selected?: boolean;
  snapToGrid?: boolean;
  gridSize?: number;
  onPositionChange?: (id: string, position: CanvasPosition) => void;
  onClick?: (id: string, event: React.MouseEvent) => void;
  onDoubleClick?: (id: string, event: React.MouseEvent) => void;
  onContextMenu?: (id: string, event: React.MouseEvent) => void;
  className?: string;
}

const DEFAULT_SIZE: CanvasSize = { width: 200, height: 120 };

export function CanvasBlock({
  id,
  position,
  size = DEFAULT_SIZE,
  dataSource,
  selected = false,
  snapToGrid = false,
  gridSize = 20,
  onPositionChange,
  onClick,
  onDoubleClick,
  onContextMenu,
  className = '',
}: CanvasBlockProps) {
  const blockRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });

  // Get icon and color theme for data source kind
  const sourceTheme = useMemo(() => {
    switch (dataSource.kind) {
      case 'postgres':
        return {
          icon: '🐘',
          primaryColor: '#336791',
          secondaryColor: '#4A90B8',
          gradient: 'linear-gradient(135deg, #336791 0%, #4A90B8 100%)',
        };
      case 'mysql':
        return {
          icon: '🐬',
          primaryColor: '#00546B',
          secondaryColor: '#00758F',
          gradient: 'linear-gradient(135deg, #00546B 0%, #00758F 100%)',
        };
      case 'mongo':
        return {
          icon: '🍃',
          primaryColor: '#4DB33D',
          secondaryColor: '#6CC04A',
          gradient: 'linear-gradient(135deg, #4DB33D 0%, #6CC04A 100%)',
        };
      case 'duckdb':
        return {
          icon: '🦆',
          primaryColor: '#FFA500',
          secondaryColor: '#FFB84D',
          gradient: 'linear-gradient(135deg, #FFA500 0%, #FFB84D 100%)',
        };
      default:
        return {
          icon: '📊',
          primaryColor: '#6B7280',
          secondaryColor: '#9CA3AF',
          gradient: 'linear-gradient(135deg, #6B7280 0%, #9CA3AF 100%)',
        };
    }
  }, [dataSource.kind]);

  // Get status indicator
  const statusInfo = useMemo(() => {
    if (dataSource.connectionStatus === 'error' || dataSource.crawlStatus === 'error') {
      return { icon: '❌', color: '#ef4444', label: 'Error', pulse: false };
    } else if (dataSource.connectionStatus === 'checking' || dataSource.crawlStatus === 'crawling') {
      return { icon: '⏳', color: '#f59e0b', label: 'Processing', pulse: true };
    } else if (dataSource.connectionStatus === 'connected' && dataSource.crawlStatus === 'crawled') {
      return { icon: '✅', color: '#10b981', label: 'Ready', pulse: false };
    } else if (dataSource.connectionStatus === 'connected') {
      return { icon: '🔗', color: '#3b82f6', label: 'Connected', pulse: false };
    } else {
      return { icon: '⚪', color: '#6b7280', label: 'Unknown', pulse: false };
    }
  }, [dataSource.connectionStatus, dataSource.crawlStatus]);

  // Snap position to grid if enabled
  const snapToGridPosition = useCallback((pos: CanvasPosition): CanvasPosition => {
    if (!snapToGrid) return pos;
    return {
      x: Math.round(pos.x / gridSize) * gridSize,
      y: Math.round(pos.y / gridSize) * gridSize,
    };
  }, [snapToGrid, gridSize]);

  // Handle drag start
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (event.button !== 0) return; // Only handle left mouse button

    event.preventDefault();
    event.stopPropagation();

    const rect = blockRef.current?.getBoundingClientRect();
    if (!rect) return;

    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    setIsDragging(true);
    setDragOffset({ x: offsetX, y: offsetY });
    setDragStartPos(position);

    // Add global mouse events
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    if (blockRef.current) {
      blockRef.current.style.cursor = 'grabbing';
    }
  }, [position]);

  // Handle drag move
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDragging) return;

    event.preventDefault();

    // Calculate new position based on mouse movement
    const newPosition = {
      x: event.clientX - dragOffset.x - (size.width / 2),
      y: event.clientY - dragOffset.y - (size.height / 2),
    };

    const snappedPosition = snapToGridPosition(newPosition);
    onPositionChange?.(id, snappedPosition);
  }, [isDragging, dragOffset, size, snapToGridPosition, onPositionChange, id]);

  // Handle drag end
  const handleMouseUp = useCallback((event: MouseEvent) => {
    if (!isDragging) return;

    event.preventDefault();
    setIsDragging(false);

    // Remove global mouse events
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);

    if (blockRef.current) {
      blockRef.current.style.cursor = '';
    }
  }, [isDragging, handleMouseMove]);

  // Handle click
  const handleClick = useCallback((event: React.MouseEvent) => {
    if (isDragging) return; // Don't trigger click if we were dragging
    event.stopPropagation();
    onClick?.(id, event);
  }, [isDragging, onClick, id]);

  // Handle double click
  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    onDoubleClick?.(id, event);
  }, [onDoubleClick, id]);

  // Handle context menu
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onContextMenu?.(id, event);
  }, [onContextMenu, id]);

  // Calculate transform style
  const transform = `translate(${position.x}px, ${position.y}px)`;

  return (
    <div
      ref={blockRef}
      className={`canvas-block ${selected ? 'canvas-block--selected' : ''} ${isDragging ? 'canvas-block--dragging' : ''} ${className}`}
      style={{
        transform,
        width: size.width,
        height: size.height,
        background: sourceTheme.gradient,
        '--status-color': statusInfo.color,
      } as React.CSSProperties}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    >
      {/* Status indicator */}
      <div className={`canvas-block__status ${statusInfo.pulse ? 'canvas-block__status--pulse' : ''}`}>
        <span className="canvas-block__status-icon" title={statusInfo.label}>
          {statusInfo.icon}
        </span>
      </div>

      {/* Connection icon and type */}
      <div className="canvas-block__header">
        <span className="canvas-block__icon" title={dataSource.kind}>
          {sourceTheme.icon}
        </span>
        <span className="canvas-block__kind">{dataSource.kind.toUpperCase()}</span>
      </div>

      {/* Connection name */}
      <div className="canvas-block__title" title={dataSource.name}>
        {dataSource.name}
      </div>

      {/* Database name if available */}
      {dataSource.databaseName && (
        <div className="canvas-block__subtitle" title={`Database: ${dataSource.databaseName}`}>
          {dataSource.databaseName}
        </div>
      )}

      {/* Table count if available */}
      {dataSource.tableCount !== undefined && (
        <div className="canvas-block__meta">
          {dataSource.tableCount} {dataSource.tableCount === 1 ? 'table' : 'tables'}
        </div>
      )}

      {/* Error message if in error state */}
      {(dataSource.connectionStatus === 'error' || dataSource.crawlStatus === 'error') && 
       dataSource.lastError && (
        <div className="canvas-block__error" title={dataSource.lastError}>
          ⚠️ Error
        </div>
      )}

      {/* Connection point for relationships (placeholder) */}
      <div className="canvas-block__connection-point" title="Create relationship">
        +
      </div>

      {/* Selection outline */}
      {selected && <div className="canvas-block__selection-outline" />}
    </div>
  );
}