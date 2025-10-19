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
  isConnectionTarget?: boolean;
  isConnectionMode?: boolean;
  onPositionChange?: (id: string, position: CanvasPosition) => void;
  onClick?: (id: string, event: React.MouseEvent) => void;
  onDoubleClick?: (id: string, event: React.MouseEvent) => void;
  onContextMenu?: (id: string, event: React.MouseEvent) => void;
  onConnectionStart?: (blockId: string, position: CanvasPosition) => void;
  onConnectionTarget?: (blockId: string, position: CanvasPosition) => void;
  onConnectionTargetLeave?: () => void;
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
  isConnectionTarget = false,
  isConnectionMode = false,
  onPositionChange,
  onClick,
  onDoubleClick,
  onContextMenu,
  onConnectionStart,
  onConnectionTarget,
  onConnectionTargetLeave,
  className = '',
}: CanvasBlockProps) {
  const blockRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  
  // Connection dot state
  const [connectionDot, setConnectionDot] = useState<{
    visible: boolean;
    x: number;
    y: number;
    active: boolean;
  }>({ visible: false, x: 0, y: 0, active: false });

  // Get icon and color theme for data source kind
  const sourceTheme = useMemo(() => {
    switch (dataSource.kind) {
      case 'postgres':
        return {
          icon: '🐘',
          primaryColor: 'rgba(51, 103, 145, 0.3)',
          secondaryColor: 'rgba(74, 144, 184, 0.2)',
          gradient: 'linear-gradient(135deg, rgba(51, 103, 145, 0.15) 0%, rgba(74, 144, 184, 0.1) 100%)',
        };
      case 'mysql':
        return {
          icon: '🐬',
          primaryColor: 'rgba(0, 84, 107, 0.3)',
          secondaryColor: 'rgba(0, 117, 143, 0.2)',
          gradient: 'linear-gradient(135deg, rgba(0, 84, 107, 0.15) 0%, rgba(0, 117, 143, 0.1) 100%)',
        };
      case 'mongo':
        return {
          icon: '🍃',
          primaryColor: 'rgba(77, 179, 61, 0.3)',
          secondaryColor: 'rgba(108, 192, 74, 0.2)',
          gradient: 'linear-gradient(135deg, rgba(77, 179, 61, 0.15) 0%, rgba(108, 192, 74, 0.1) 100%)',
        };
      case 'duckdb':
        return {
          icon: '🦆',
          primaryColor: 'rgba(255, 165, 0, 0.3)',
          secondaryColor: 'rgba(255, 184, 77, 0.2)',
          gradient: 'linear-gradient(135deg, rgba(255, 165, 0, 0.15) 0%, rgba(255, 184, 77, 0.1) 100%)',
        };
      default:
        return {
          icon: '📊',
          primaryColor: 'rgba(107, 114, 128, 0.3)',
          secondaryColor: 'rgba(156, 163, 175, 0.2)',
          gradient: 'linear-gradient(135deg, rgba(107, 114, 128, 0.15) 0%, rgba(156, 163, 175, 0.1) 100%)',
        };
    }
  }, [dataSource.kind]);

  // Get status class for glow border
  const statusClass = useMemo(() => {
    if (dataSource.connectionStatus === 'error' || dataSource.crawlStatus === 'error') {
      return 'canvas-block--status-error';
    } else if (dataSource.connectionStatus === 'checking' || dataSource.crawlStatus === 'crawling') {
      return 'canvas-block--status-checking';
    } else if (dataSource.connectionStatus === 'connected' && dataSource.crawlStatus === 'crawled') {
      return 'canvas-block--status-ready';
    } else if (dataSource.connectionStatus === 'connected') {
      return 'canvas-block--status-connected';
    } else {
      return 'canvas-block--status-unknown';
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
    isDraggingRef.current = true;
    setDragOffset({ x: offsetX, y: offsetY });
    setDragStartPos(position);

    // Add global mouse events
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    if (blockRef.current) {
      blockRef.current.style.cursor = 'grabbing';
    }
  }, [position, id]);

  // Handle drag move
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDraggingRef.current) return;

    
    event.preventDefault();

    // Get the canvas container to calculate relative position
    const canvas = blockRef.current?.closest('.canvas__content');
    const canvasRect = canvas?.getBoundingClientRect();
    if (!canvasRect) {
      console.log('No canvas rect found for dragging');
      return;
    }

    // Calculate new position relative to canvas content, accounting for drag offset
    const newPosition = {
      x: event.clientX - canvasRect.left - dragOffset.x,
      y: event.clientY - canvasRect.top - dragOffset.y,
    };

    
    const snappedPosition = snapToGridPosition(newPosition);
    onPositionChange?.(id, snappedPosition);
  }, [dragOffset, snapToGridPosition, onPositionChange, id]);

  // Handle drag end
  const handleMouseUp = useCallback((event: MouseEvent) => {
    if (!isDraggingRef.current) return;

    
    event.preventDefault();
    setIsDragging(false);
    isDraggingRef.current = false;

    // Remove global mouse events
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);

    if (blockRef.current) {
      blockRef.current.style.cursor = '';
    }
  }, [handleMouseMove, id]);

  // Handle click
  const handleClick = useCallback((event: React.MouseEvent) => {
    if (isDragging) return; // Don't trigger click if we were dragging
    
    // If in connection mode and this is a target block, complete the connection
    if (isConnectionMode && isConnectionTarget) {
      console.log('🎯 Target block clicked - completing connection:', id);
      // Don't stop propagation - let it bubble to canvas handler
      // But don't call onClick
      return;
    }
    
    event.stopPropagation();
    onClick?.(id, event);
  }, [isDragging, isConnectionMode, isConnectionTarget, onClick, id]);

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

  // Handle connection point click
  const handleConnectionStart = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    // Calculate connection point position relative to canvas (right edge, center)
    const connectionPosition = {
      x: position.x + size.width, // Right edge of block
      y: position.y + size.height / 2  // Middle of block height
    };
    
    
    if (onConnectionStart) {
      onConnectionStart(id, connectionPosition);
    } else {
      console.warn('onConnectionStart handler not provided');
    }
  }, [id, position, size, onConnectionStart]);

  // Handle mouse movement for connection dot
  const handleBlockMouseMove = useCallback((event: React.MouseEvent) => {
    if (isDragging) return;
    // Allow connection dots to show even in connection mode for target selection
    
    // Don't show connection dot if block is in error state
    if (dataSource.connectionStatus === 'error' || dataSource.crawlStatus === 'error') {
      setConnectionDot(prev => ({ ...prev, visible: false }));
      return;
    }
    
    const rect = blockRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Get mouse position relative to block
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Check if mouse is within block bounds first
    if (mouseX < 0 || mouseX > size.width || mouseY < 0 || mouseY > size.height) {
      setConnectionDot(prev => ({ ...prev, visible: false }));
      return;
    }
    
    // Calculate distance from each border
    const distFromLeft = mouseX;
    const distFromRight = size.width - mouseX;
    const distFromTop = mouseY;
    const distFromBottom = size.height - mouseY;
    
    // Find the closest border
    const minDistance = Math.min(distFromLeft, distFromRight, distFromTop, distFromBottom);
    const borderThreshold = 20; // Fixed 20px threshold instead of percentage
    
    if (minDistance <= borderThreshold) {
      let dotX = 0, dotY = 0;
      
      // Position dot on the closest border
      if (minDistance === distFromLeft) {
        dotX = 0;
        dotY = mouseY;
      } else if (minDistance === distFromRight) {
        dotX = size.width;
        dotY = mouseY;
      } else if (minDistance === distFromTop) {
        dotX = mouseX;
        dotY = 0;
      } else if (minDistance === distFromBottom) {
        dotX = mouseX;
        dotY = size.height;
      }
      
      setConnectionDot({
        visible: true,
        x: dotX,
        y: dotY,
        active: connectionDot.active
      });
    } else {
      setConnectionDot(prev => ({ ...prev, visible: false }));
    }
  }, [isDragging, size, connectionDot.active, dataSource.connectionStatus, dataSource.crawlStatus]);

  // Handle mouse enter when in connection mode
  const handleMouseEnter = useCallback(() => {
    if (isConnectionMode && onConnectionTarget) {
      const targetPosition = {
        x: position.x, // Left side of block
        y: position.y + size.height / 2
      };
      onConnectionTarget(id, targetPosition);
    }
  }, [isConnectionMode, id, position, size, onConnectionTarget]);

  // Handle mouse leave when in connection mode
  const handleMouseLeave = useCallback(() => {
    if (isConnectionMode && onConnectionTargetLeave) {
      onConnectionTargetLeave();
    }
    // Hide connection dot when leaving block
    setConnectionDot(prev => ({ ...prev, visible: false }));
  }, [isConnectionMode, onConnectionTargetLeave]);

  // Calculate transform style
  const transform = `translate(${position.x}px, ${position.y}px)`;

  return (
    <div
      ref={blockRef}
      className={`canvas-block ${statusClass} ${selected ? 'canvas-block--selected' : ''} ${isDragging ? 'canvas-block--dragging' : ''} ${isConnectionTarget ? 'canvas-block--connection-target' : ''} ${isConnectionMode ? 'canvas-block--connection-mode' : ''} ${className}`}
      style={{
        transform,
        width: size.width,
        height: size.height,
      } as React.CSSProperties}
      onMouseDown={handleMouseDown}
      onMouseMove={handleBlockMouseMove}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Status is now handled by border glow - no need for separate indicator */}

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

      {/* Dynamic connection dot */}
      {connectionDot.visible && (
        <div 
          className={`canvas-block__connection-dot ${
            connectionDot.visible ? 'canvas-block__connection-dot--visible' : ''
          } ${
            connectionDot.active ? 'canvas-block__connection-dot--active' : ''
          }`}
          style={{
            left: connectionDot.x,
            top: connectionDot.y,
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🟦 Connection dot clicked:', { id, connectionDot, position });
            // Calculate connection position in canvas coordinates
            const connectionPosition = {
              x: position.x + connectionDot.x,
              y: position.y + connectionDot.y
            };
            console.log('🟦 Calculated connection position:', connectionPosition);
            if (onConnectionStart) {
              setConnectionDot(prev => ({ ...prev, active: true }));
              onConnectionStart(id, connectionPosition);
            } else {
              console.warn('onConnectionStart handler not provided');
            }
          }}
          title="Create connection"
        />
      )}

      {/* Selection outline */}
      {selected && <div className="canvas-block__selection-outline" />}
    </div>
  );
}