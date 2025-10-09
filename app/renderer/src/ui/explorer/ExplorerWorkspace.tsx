import { InspectorPanel } from './inspector/InspectorPanel';
import { useExplorerState } from './state/useExplorerState';
import './ExplorerWorkspace.css';

export function ExplorerWorkspace() {
  const { inspector } = useExplorerState();

  if (!inspector.selectedNode) {
    return (
      <div className="explorer-workspace-empty">
        <h3>Select a table or collection to view its details.</h3>
        <p>The inspector will show owners, tags, and profiling stats once you pick an entity.</p>
      </div>
    );
  }

  return (
    <div className="explorer-workspace">
      <InspectorPanel
        node={inspector.selectedNode}
        breadcrumbs={inspector.breadcrumbs}
        metadata={inspector.metadata}
        stats={inspector.stats}
        lastCrawledAt={inspector.lastCrawledAt}
        lastError={inspector.lastError}
      />
      <div className="explorer-workspace__panel explorer-workspace__panel--placeholder">
        <h3>Results preview</h3>
        <div className="results-grid-placeholder">
          <p className="results-grid-placeholder__hint">
            Query results and masking controls will appear after the results grid framework lands.
          </p>
          <div className="results-grid-placeholder__actions">
            <button type="button" className="results-grid-placeholder__button" disabled>
              Mask PII columns
            </button>
            <button type="button" className="results-grid-placeholder__button" disabled>
              Toggle sample rows
            </button>
            <button type="button" className="results-grid-placeholder__button" disabled>
              Export preview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


