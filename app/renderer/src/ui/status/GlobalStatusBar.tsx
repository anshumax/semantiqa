import React, { useEffect, useState } from 'react';
import { StatusDrawer } from './StatusDrawer';
import './GlobalStatusBar.css';

interface ActiveCrawl {
  sourceId: string;
  sourceName: string;
}

export function GlobalStatusBar() {
  const [activeCrawls, setActiveCrawls] = useState<ActiveCrawl[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    const handleStatusEvent = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      
      if (detail.kind === 'crawl') {
        if (detail.crawlStatus === 'crawling') {
          // Add or update active crawl
          setActiveCrawls(prev => {
            const filtered = prev.filter(c => c.sourceId !== detail.sourceId);
            return [...filtered, { 
              sourceId: detail.sourceId, 
              sourceName: detail.sourceName || detail.sourceId 
            }];
          });
        } else if (detail.crawlStatus === 'crawled' || detail.crawlStatus === 'error') {
          // Remove completed/failed crawl after 2 seconds
          setTimeout(() => {
            setActiveCrawls(prev => prev.filter(c => c.sourceId !== detail.sourceId));
          }, 2000);
        }
      }
    };
    
    window.addEventListener('sources:status', handleStatusEvent as EventListener);
    return () => window.removeEventListener('sources:status', handleStatusEvent as EventListener);
  }, []);

  const handleBarClick = () => {
    if (activeCrawls.length > 0) {
      setIsDrawerOpen(true);
    }
  };

  return (
    <>
      <div 
        className={`global-status-bar ${activeCrawls.length > 0 ? 'global-status-bar--active' : ''}`}
        onClick={handleBarClick}
        style={{ cursor: activeCrawls.length > 0 ? 'pointer' : 'default' }}
        role={activeCrawls.length > 0 ? 'button' : undefined}
        tabIndex={activeCrawls.length > 0 ? 0 : undefined}
      >
        <div className="global-status-bar__content">
          {activeCrawls.length === 0 ? (
            <span className="global-status-bar__idle">✓ All sources ready</span>
          ) : activeCrawls.length === 1 ? (
            <span>⟳ Crawling: <strong>{activeCrawls[0].sourceName}</strong></span>
          ) : (
            <span>⟳ Crawling {activeCrawls.length} sources • Click for details</span>
          )}
        </div>
      </div>
      <StatusDrawer 
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activeCrawls={activeCrawls}
      />
    </>
  );
}

