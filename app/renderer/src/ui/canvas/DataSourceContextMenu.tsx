import React, { useCallback, useEffect, useRef } from 'react';
import './DataSourceContextMenu.css';

export interface DataSourceContextMenuProps {
  x: number;
  y: number;
  visible: boolean;
  sourceId: string;
  blockId: string;
  onClose: () => void;
  onViewDetails?: () => void;
  onRetryCrawl?: () => void;
  onRetryConnection?: () => void;
  onDelete?: (blockId: string, sourceId: string) => void;
  canRetryCrawl?: boolean;
  hasConnectionError?: boolean;
}

export function DataSourceContextMenu({
  x,
  y,
  visible,
  sourceId,
  blockId,
  onClose,
  onViewDetails,
  onRetryCrawl,
  onRetryConnection,
  onDelete,
  canRetryCrawl = false,
  hasConnectionError = false,
}: DataSourceContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const handleViewDetails = useCallback(() => {
    if (onViewDetails) {
      onViewDetails();
    }
    onClose();
  }, [onViewDetails, onClose]);

  const handleRetryCrawl = useCallback(() => {
    if (onRetryCrawl) {
      onRetryCrawl();
    }
    onClose();
  }, [onRetryCrawl, onClose]);

  const handleRetryConnection = useCallback(() => {
    if (onRetryConnection) {
      onRetryConnection();
    }
    onClose();
  }, [onRetryConnection, onClose]);

  const handleDelete = useCallback(() => {
    if (onDelete) {
      onDelete(blockId, sourceId);
    }
    onClose();
  }, [onDelete, blockId, sourceId, onClose]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      className="data-source-context-menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 1000,
      }}
    >
      {onViewDetails && (
        <div
          className="data-source-context-menu__item"
          onClick={handleViewDetails}
        >
          📋 View details
        </div>
      )}
      {canRetryCrawl && (
        <div
          className="data-source-context-menu__item"
          onClick={handleRetryCrawl}
        >
          🔄 Retry crawl
        </div>
      )}
      {hasConnectionError && onRetryConnection && (
        <div
          className="data-source-context-menu__item"
          onClick={handleRetryConnection}
        >
          🔌 Retry connectivity check
        </div>
      )}
      <div
        className="data-source-context-menu__item data-source-context-menu__item--delete"
        onClick={handleDelete}
      >
        🗑️ Delete data source
      </div>
    </div>
  );
}
