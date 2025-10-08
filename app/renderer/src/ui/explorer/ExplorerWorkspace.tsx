import { useExplorerState } from './state/useExplorerState';
import './ExplorerWorkspace.css';

export function ExplorerWorkspace() {
  const { snapshot } = useExplorerState();

  if (!snapshot.selectedNodeId) {
    return (
      <div className="explorer-workspace explorer-workspace--empty">
        <h3>Select a table or collection to view its details.</h3>
        <p>The inspector and results grid will appear here as you explore schema entities.</p>
      </div>
    );
  }

  return (
    <div className="explorer-workspace">
      <div className="explorer-workspace__panel">
        <h3>{snapshot.selectedNodeId}</h3>
        <p>Detail and inspector views will render in T-015.</p>
      </div>
    </div>
  );
}


