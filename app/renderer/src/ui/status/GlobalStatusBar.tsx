import React, { useEffect, useState } from 'react';
import { AppShell, Group, Text, Tooltip } from '@mantine/core';
import { StatusDrawer } from './StatusDrawer';
import './GlobalStatusBar.css';

interface ActiveCrawl {
  sourceId: string;
  sourceName: string;
}

interface GlobalStatusBarProps {
  env: string;
  pingStatus: 'pending' | 'ok' | 'error';
  pingTimestamp: string;
}

export function GlobalStatusBar({ env, pingStatus, pingTimestamp }: GlobalStatusBarProps) {
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

  const getStatusColor = (status: 'pending' | 'ok' | 'error') => {
    switch (status) {
      case 'ok': return '#8ae6b8';
      case 'error': return '#e0a2a8';
      case 'pending': return '#a1a6b3';
    }
  };

  const getStatusTooltip = (status: 'pending' | 'ok' | 'error', timestamp: string) => {
    switch (status) {
      case 'ok': return `ok @ ${timestamp}`;
      case 'error': return 'error';
      case 'pending': return 'checking…';
    }
  };

  return (
    <>
      <AppShell.Footer p="xs">
        <Group justify="space-between" gap="md" style={{ height: '100%' }}>
          {/* Left side: Crawl status */}
          <div 
            className={`global-status-bar__crawl ${activeCrawls.length > 0 ? 'active' : ''}`}
            onClick={handleBarClick}
            style={{ cursor: activeCrawls.length > 0 ? 'pointer' : 'default' }}
            role={activeCrawls.length > 0 ? 'button' : undefined}
            tabIndex={activeCrawls.length > 0 ? 0 : undefined}
          >
            {activeCrawls.length === 0 ? (
              <Text size="sm" c="dimmed">✓ All sources ready</Text>
            ) : activeCrawls.length === 1 ? (
              <Text size="sm">⟳ Crawling: <strong>{activeCrawls[0].sourceName}</strong></Text>
            ) : (
              <Text size="sm">⟳ Crawling {activeCrawls.length} sources • Click for details</Text>
            )}
          </div>

          {/* Right side: Environment and IPC status */}
          <Group gap="lg">
            <Tooltip label={`Environment: ${env}`} withArrow>
              <Group gap={6}>
                <div 
                  style={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: '50%', 
                    backgroundColor: '#a1a6b3'
                  }} 
                />
                <Text size="sm" c="dimmed">Environment: {env}</Text>
              </Group>
            </Tooltip>

            <Tooltip label={getStatusTooltip(pingStatus, pingTimestamp)} withArrow>
              <Group gap={6}>
                <div 
                  style={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: '50%', 
                    backgroundColor: getStatusColor(pingStatus)
                  }} 
                />
                <Text size="sm" c="dimmed">IPC</Text>
              </Group>
            </Tooltip>
          </Group>
        </Group>
      </AppShell.Footer>
      
      <StatusDrawer 
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activeCrawls={activeCrawls}
      />
    </>
  );
}

