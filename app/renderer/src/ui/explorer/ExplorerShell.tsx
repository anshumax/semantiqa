import { ExplorerStateProvider } from './state/useExplorerState';
import { useExplorerSnapshot } from './useExplorerSnapshot';
import { ExplorerSidebar } from './ExplorerSidebar';
import { ExplorerWorkspace } from './ExplorerWorkspace';

export function ExplorerShell() {
  const { state, loadSnapshot } = useExplorerSnapshot();

  return (
    <ExplorerStateProvider initialSnapshot={state.snapshot ?? null}>
      <div className="explorer-shell">
        <ExplorerSidebar />
        {state.status === 'loading' && !state.snapshot ? (
          <div className="explorer-shell__empty">
            <h3>Loading sources…</h3>
            <p>Fetching the latest metadata snapshot from the local store.</p>
          </div>
        ) : state.status === 'error' ? (
          <div className="explorer-shell__empty explorer-shell__empty--error">
            <h3>Something went wrong</h3>
            <p>{state.error.message}</p>
            <button type="button" onClick={loadSnapshot}>
              Retry
            </button>
          </div>
        ) : (
          <ExplorerWorkspace />
        )}
      </div>
    </ExplorerStateProvider>
  );
}

