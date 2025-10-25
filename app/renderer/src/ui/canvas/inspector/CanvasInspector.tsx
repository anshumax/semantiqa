import { useEffect } from 'react';
import { InspectorEmptyState } from './InspectorEmptyState';
import { InspectorSourcePanel } from './InspectorSourcePanel';
import { InspectorTablePanel } from './InspectorTablePanel';
import { InspectorRelationshipPanel } from './InspectorRelationshipPanel';
import './CanvasInspector.css';

export interface InspectorSelection {
  type: 'data-source' | 'table' | 'relationship';
  id: string;
  sourceId?: string; // For table selection
}

export interface CanvasInspectorProps {
  selection: InspectorSelection | null;
  onClose: () => void;
}

export function CanvasInspector({ selection, onClose }: CanvasInspectorProps) {
  // Handle Escape key to close inspector
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selection) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selection, onClose]);

  return (
    <aside 
      className={`canvas-inspector ${selection ? 'canvas-inspector--open' : ''}`}
      role="complementary"
      aria-label="Inspector panel"
    >
      <div className="canvas-inspector__content">
        {!selection && <InspectorEmptyState />}
        {selection?.type === 'data-source' && (
          <InspectorSourcePanel sourceId={selection.id} onClose={onClose} />
        )}
        {selection?.type === 'table' && selection.sourceId && (
          <InspectorTablePanel 
            sourceId={selection.sourceId} 
            tableId={selection.id} 
            onClose={onClose} 
          />
        )}
        {selection?.type === 'relationship' && (
          <InspectorRelationshipPanel relationshipId={selection.id} onClose={onClose} />
        )}
      </div>
    </aside>
  );
}

