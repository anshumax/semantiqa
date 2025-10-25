import React, { useState, useRef, useCallback } from 'react';
import './TableBlock.css';
import { TableInfo } from './navigationTypes';

export interface TableBlockProps {
  table: TableInfo;
  x: number;
  y: number;
  width?: number;
  height?: number;
  selected?: boolean;
  sourceKind: 'postgres' | 'mysql' | 'mongo' | 'duckdb';
  onPositionChange?: (tableId: string, newX: number, newY: number) => void;
  onClick?: (tableId: string) => void;
  onDoubleClick?: (tableId: string) => void;
  onContextMenu?: (tableId: string, event: React.MouseEvent) => void;
}

export function TableBlock({
  table,
  x,
  y,
  width = 180,
  height = 100,
  selected = false,
  sourceKind,
  onPositionChange,
  onClick,
  onDoubleClick,
  onContextMenu
}: TableBlockProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const blockRef = useRef<HTMLDivElement>(null);

  const getTableIcon = () => {
    if (!table?.type) return '🗂️';
    switch (table.type) {
      case 'view':
        return '👁️';
      case 'collection':
        return '📄';
      default:
        return '🗂️';
    }
  };

  const getSourceKindColor = () => {
    switch (sourceKind) {
      case 'postgres':
        return 'linear-gradient(135deg, #336791 0%, #4a7bb7 100%)';
      case 'mysql':
        return 'linear-gradient(135deg, #e97627 0%, #f39c12 100%)';
      case 'mongo':
        return 'linear-gradient(135deg, #4db33d 0%, #5cb85c 100%)';
      case 'duckdb':
        return 'linear-gradient(135deg, #ff6b35 0%, #ff8c42 100%)';
      default:
        return 'linear-gradient(135deg, #666 0%, #888 100%)';
    }
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only handle left click
    
    const rect = blockRef.current?.getBoundingClientRect();
    if (!rect) return;

    setIsDragging(true);
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });

    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    // Get the canvas content container to calculate relative position
    const canvasContent = blockRef.current?.closest('.canvas__content');
    const canvasRect = canvasContent?.getBoundingClientRect();
    if (!canvasRect) return;

    // Calculate new position relative to canvas content, accounting for drag offset
    const newX = e.clientX - canvasRect.left - dragOffset.x;
    const newY = e.clientY - canvasRect.top - dragOffset.y;

    // Snap to grid (optional)
    const gridSize = 10;
    const snappedX = Math.round(newX / gridSize) * gridSize;
    const snappedY = Math.round(newY / gridSize) * gridSize;

    onPositionChange?.(table.id, snappedX, snappedY);
  }, [isDragging, dragOffset, table.id, onPositionChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(table.id);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick?.(table.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(table.id, e);
  };

  return (
    <div
      ref={blockRef}
      className={`table-block ${isDragging ? 'table-block--dragging' : ''} ${selected ? 'table-block--selected' : ''}`}
      style={{
        transform: `translate(${x}px, ${y}px)`,
        width: `${width}px`,
        height: `${height}px`,
        background: getSourceKindColor(),
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      tabIndex={0}
      role="button"
      aria-label={`${table?.type || 'table'} ${table?.name || 'unknown'}`}
    >
      {/* Selection outline */}
      {selected && <div className="table-block__selection-outline" />}

      {/* Header with icon and type */}
      <div className="table-block__header">
        <span className="table-block__icon">{getTableIcon()}</span>
        <span className="table-block__type">{table.type}</span>
      </div>

      {/* Table name */}
      <div className="table-block__name" title={table.name}>
        {table.name}
      </div>

      {/* Schema if available */}
      {table.schema && (
        <div className="table-block__schema" title={`Schema: ${table.schema}`}>
          {table.schema}
        </div>
      )}

      {/* Description tooltip on hover */}
      {table.description && (
        <div className="table-block__description" title={table.description}>
          ℹ️
        </div>
      )}
    </div>
  );
}