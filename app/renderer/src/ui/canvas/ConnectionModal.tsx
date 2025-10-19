import React from 'react';
import './ConnectionModal.css';

export interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceBlock?: {
    id: string;
    name: string;
    kind: string;
  };
  targetBlock?: {
    id: string;
    name: string;
    kind: string;
  };
}

export function ConnectionModal({ 
  isOpen, 
  onClose, 
  sourceBlock, 
  targetBlock 
}: ConnectionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="connection-modal-overlay" onClick={onClose}>
      <div className="connection-modal" onClick={(e) => e.stopPropagation()}>
        <div className="connection-modal__header">
          <h2>Create Connection</h2>
          <button 
            className="connection-modal__close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        
        <div className="connection-modal__body">
          {sourceBlock && targetBlock && (
            <div className="connection-info">
              <div className="connection-endpoint">
                <div className="connection-endpoint__label">From</div>
                <div className="connection-endpoint__name">{sourceBlock.name}</div>
                <div className="connection-endpoint__type">{sourceBlock.kind.toUpperCase()}</div>
              </div>
              
              <div className="connection-arrow">→</div>
              
              <div className="connection-endpoint">
                <div className="connection-endpoint__label">To</div>
                <div className="connection-endpoint__name">{targetBlock.name}</div>
                <div className="connection-endpoint__type">{targetBlock.kind.toUpperCase()}</div>
              </div>
            </div>
          )}
          
          <div className="connection-placeholder">
            <p>Connection configuration will be implemented here.</p>
            <p>This is a placeholder modal for the connection creation UX flow.</p>
          </div>
        </div>
        
        <div className="connection-modal__footer">
          <button 
            className="connection-modal__button connection-modal__button--secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            className="connection-modal__button connection-modal__button--primary"
            onClick={() => {
              // TODO: Implement actual connection creation
              console.log('Connection would be created between:', sourceBlock?.id, 'and', targetBlock?.id);
              onClose();
            }}
          >
            Create Connection
          </button>
        </div>
      </div>
    </div>
  );
}