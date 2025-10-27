import { useCallback, useEffect, useRef } from 'react';
import './CanvasPaneContextMenu.css';

export interface CanvasPaneContextMenuProps {
  x: number;
  y: number;
  visible: boolean;
  onClose: () => void;
  onAutoArrange?: () => void;
}

export function CanvasPaneContextMenu({
  x,
  y,
  visible,
  onClose,
  onAutoArrange,
}: CanvasPaneContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const handleAutoArrange = useCallback(() => {
    if (onAutoArrange) {
      onAutoArrange();
    }
    onClose();
  }, [onAutoArrange, onClose]);

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
      className="canvas-pane-context-menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 1000,
      }}
    >
      {onAutoArrange && (
        <div
          className="canvas-pane-context-menu__item"
          onClick={handleAutoArrange}
        >
          ✨ Auto Arrange
        </div>
      )}
    </div>
  );
}

