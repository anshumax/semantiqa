import { useExplorerState } from './state/useExplorerState';
import { ExplorerTree } from './ExplorerTree';
import './ExplorerSidebar.css';

export function ExplorerSidebar() {
  const { snapshot, actions } = useExplorerState();

  return (
    <aside className="explorer-sidebar">
      <div className="explorer-sidebar__header">
        <h2>Sources</h2>
        <p>Select a source to explore its schemas and tables.</p>
      </div>
      <div className="explorer-sidebar__content">
        <ExplorerTree
          sources={snapshot.sources}
          nodes={snapshot.nodes}
          onToggle={(nodeId) => actions.toggleNode(nodeId)}
          onSelect={(nodeId) => actions.selectNode(nodeId)}
          expandedNodeIds={snapshot.expandedNodeIds}
          selectedNodeId={snapshot.selectedNodeId}
        />
      </div>
    </aside>
  );
}


