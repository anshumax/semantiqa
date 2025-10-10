import { useExplorerState } from './state/useExplorerState';
import { ExplorerTree } from './ExplorerTree';
import { SourceStatusPanel } from './SourceStatusPanel';
import './ExplorerSidebar.css';

export function ExplorerSidebar() {
  const { snapshot, actions, runtimeStatuses, commands } = useExplorerState();

  return (
    <aside className="explorer-sidebar">
      <div className="explorer-sidebar__header">
        <div className="explorer-sidebar__title">
          <h2>Sources</h2>
          <div className="explorer-sidebar__actions">
            <button
              type="button"
              onClick={() => commands.crawlAll().catch((error) => console.error('Failed to queue crawl-all', error))}
              className="explorer-sidebar__crawl-all"
            >
              Crawl all
            </button>
            <button type="button" onClick={actions.openConnectSource} className="explorer-sidebar__connect">
              Connect source
            </button>
          </div>
        </div>
        <p>Select a source to explore its schemas and tables. Trigger metadata crawls to refresh status.</p>
      </div>
      <SourceStatusPanel sources={snapshot.sources} runtimeStatuses={runtimeStatuses} onRetry={(sourceId) => commands.retryCrawl(sourceId).catch((error) => console.error('Failed to queue crawl', error))} />
      <div className="explorer-sidebar__content">
        <ExplorerTree
          sources={snapshot.sources}
          nodes={snapshot.nodes}
          onToggle={(nodeId) => actions.toggleNode(nodeId)}
          onSelect={(nodeId) => actions.selectNode(nodeId)}
          expandedNodeIds={snapshot.expandedNodeIds}
          selectedNodeId={snapshot.selectedNodeId}
          onConnectSource={actions.openConnectSource}
        />
      </div>
    </aside>
  );
}


