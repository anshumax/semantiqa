import React, { useCallback, useEffect, useRef } from 'react';
import './DataSourceContextMenu.css';

export interface DataSourceContextMenuProps {
  x: number;
  y: number;
  visible: boolean;
  sourceId: string;
  blockId: string;
  onClose: () => void;
  onRetryCrawl?: () => void;
  onDelete?: (blockId: string, sourceId: string) => void;
  canRetryCrawl?: boolean;
}

export function DataSourceContextMenu({
  x,
  y,
  visible,
  sourceId,
  blockId,
  onClose,
  onRetryCrawl,
  onDelete,
  canRetryCrawl = false,
}: DataSourceContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const handleRetryCrawl = useCallback(() => {
    if (onRetryCrawl) {
      onRetryCrawl();
    }
    onClose();
  }, [onRetryCrawl, onClose]);

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
      {canRetryCrawl && (
        <div
          className="data-source-context-menu__item"
          onClick={handleRetryCrawl}
        >
          🔄 Retry crawl
        </div>
      )}
      <div
        className="data-source-context-menu__item data-source-context-menu__item--delete"
        onClick={handleDelete}
      >
        🗑️ Delete block
      </div>
    </div>
  );
}
