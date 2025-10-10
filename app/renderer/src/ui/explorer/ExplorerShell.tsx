import { Modal } from '../components';
import type { ExplorerSnapshot } from '@semantiqa/contracts';
import { ExplorerStateProvider, useExplorerState } from './state/useExplorerState';
import { useExplorerSnapshot } from './useExplorerSnapshot';
import { ExplorerSidebar } from './ExplorerSidebar';
import { ExplorerWorkspace } from './ExplorerWorkspace';
import { ConnectSourceWizard } from './connect/ConnectSourceWizard';

export function ExplorerShell() {
  return (
    <ExplorerStateProvider initialSnapshot={null}>
      <ExplorerShellContent />
    </ExplorerStateProvider>
  );
}

function ExplorerShellContent() {
  const { state, loadSnapshot } = useExplorerSnapshot();

  return (
    <ExplorerView
      loadSnapshot={loadSnapshot}
      status={state.status}
      snapshot={state.snapshot}
      error={state.status === 'error' ? state.error ?? null : null}
    />
  );
}

function ExplorerView({
  loadSnapshot,
  status,
  snapshot,
  error,
}: {
  loadSnapshot: () => void;
  status: 'idle' | 'loading' | 'ready' | 'error';
  snapshot: ExplorerSnapshot | null;
  error: Error | null;
}) {
  const { isConnectSourceOpen, actions, snapshot: explorerSnapshot } = useExplorerState();

  return (
    <>
      <div className="explorer-shell">
        <ExplorerSidebar />
        {status === 'loading' && !snapshot ? (
          <div className="explorer-shell__empty">
            <h3>Loading sources…</h3>
            <p>Fetching the latest metadata snapshot from the local store.</p>
          </div>
        ) : status === 'error' && error ? (
          <div className="explorer-shell__empty explorer-shell__empty--error">
            <h3>Something went wrong</h3>
            <p>{error.message}</p>
            <button type="button" onClick={loadSnapshot}>
              Retry
            </button>
          </div>
        ) : status === 'ready' && snapshot ? (
          <ExplorerWorkspace />
        ) : (
          <div className="explorer-shell__empty">
            <h3>Waiting for snapshot</h3>
            <p>Explorer state: {status}</p>
            <button type="button" onClick={loadSnapshot}>
              Load snapshot
            </button>
          </div>
        )}
      </div>
      <Modal
        title="Connect a data source"
        description="Provide read-only details to connect a database or dataset."
        isOpen={isConnectSourceOpen}
        onClose={actions.closeConnectSource}
      >
        <ConnectSourceWizard />
      </Modal>
    </>
  );
}

