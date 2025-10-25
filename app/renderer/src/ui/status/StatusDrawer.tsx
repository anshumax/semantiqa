import React from 'react';
import './StatusDrawer.css';

interface StatusDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeCrawls: Array<{ sourceId: string; sourceName: string }>;
}

export function StatusDrawer({ isOpen, onClose, activeCrawls }: StatusDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="status-drawer-overlay" onClick={onClose}>
      <div className="status-drawer" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>Crawl Status</h3>
          <button onClick={onClose} className="status-drawer__close">
            ✕
          </button>
        </header>
        <div className="status-drawer__content">
          {activeCrawls.length === 0 ? (
            <div className="status-drawer__empty">
              <span>✓ All sources crawled</span>
            </div>
          ) : (
            <ul className="status-drawer__list">
              {activeCrawls.map(crawl => (
                <li key={crawl.sourceId}>
                  <span className="status-drawer__spinner">⟳</span>
                  <span className="status-drawer__name">{crawl.sourceName}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

