import React, { useCallback, useEffect, useRef } from 'react';
import './RelationshipContextMenu.css';

export interface RelationshipContextMenuProps {
  x: number;
  y: number;
  visible: boolean;
  relationshipId: string;
  onClose: () => void;
  onDelete: (relationshipId: string) => void;
}

export function RelationshipContextMenu({
  x,
  y,
  visible,
  relationshipId,
  onClose,
  onDelete,
}: RelationshipContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const handleDelete = useCallback(() => {
    onDelete(relationshipId);
    onClose();
  }, [relationshipId, onDelete, onClose]);

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
      className="relationship-context-menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 1000,
      }}
    >
      <div
        className="relationship-context-menu__item relationship-context-menu__item--delete"
        onClick={handleDelete}
      >
        🗑️ Delete relationship
      </div>
    </div>
  );
}
