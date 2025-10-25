import React, { useCallback, useEffect, useRef } from 'react';
import './TableContextMenu.css';

export interface TableContextMenuProps {
  x: number;
  y: number;
  visible: boolean;
  tableId: string;
  sourceId: string;
  onClose: () => void;
  onViewDetails?: () => void;
  onDelete?: (tableId: string) => void;
}

export function TableContextMenu({
  x,
  y,
  visible,
  tableId,
  sourceId,
  onClose,
  onViewDetails,
  onDelete,
}: TableContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const handleViewDetails = useCallback(() => {
    if (onViewDetails) {
      onViewDetails();
    }
    onClose();
  }, [onViewDetails, onClose]);

  const handleDelete = useCallback(() => {
    if (onDelete) {
      onDelete(tableId);
    }
    onClose();
  }, [onDelete, tableId, onClose]);

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
      className="table-context-menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 1000,
      }}
    >
      {onViewDetails && (
        <div
          className="table-context-menu__item"
          onClick={handleViewDetails}
        >
          📋 View details
        </div>
      )}
      {onDelete && (
        <div
          className="table-context-menu__item table-context-menu__item--delete"
          onClick={handleDelete}
        >
          🗑️ Delete block
        </div>
      )}
    </div>
  );
}

