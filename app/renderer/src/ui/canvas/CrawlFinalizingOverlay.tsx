
import React from 'react';
import './CrawlFinalizingOverlay.css';

export interface CrawlFinalizingOverlayProps {
  isVisible: boolean;
  sourceName: string;
}

export function CrawlFinalizingOverlay({ isVisible, sourceName }: CrawlFinalizingOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className="crawl-finalizing-overlay">
      <div className="crawl-finalizing-overlay__content">
        <div className="crawl-finalizing-overlay__spinner"></div>
        <h3 className="crawl-finalizing-overlay__title">Finalizing {sourceName}...</h3>
        <p className="crawl-finalizing-overlay__message">Drawing relationships</p>
      </div>
    </div>
  );
}

