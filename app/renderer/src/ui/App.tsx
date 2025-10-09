import { useEffect, useState } from 'react';
import { AppStateProvider } from './state';
import { StatusBadge, StatusBadgeLabel, StatusBadgeValue } from './components';
import { ExplorerShell } from './explorer';
import './App.css';
import './components/Modal.css';

declare global {
  interface Window {
    semantiqa?: {
      api: {
        invoke: <T extends import('@semantiqa/app-config').IpcChannel>(
          channel: T,
          payload: import('@semantiqa/app-config').IpcRequest<T>,
        ) => Promise<import('@semantiqa/app-config').IpcResponse<T>>;
        ping: () => Promise<import('@semantiqa/app-config').IpcResponse<'health:ping'>>;
      };
    };
  }
}

export default function App() {
  return (
    <AppStateProvider>
      <RootContent />
    </AppStateProvider>
  );
}

function RootContent() {
  const [env, setEnv] = useState<string>('unknown');
  const [pingStatus, setPingStatus] = useState<'pending' | 'ok' | 'error'>('pending');
  const [pingTimestamp, setPingTimestamp] = useState<string>('');

  useEffect(() => {
    setEnv(process.env.NODE_ENV ?? 'unknown');

    window.semantiqa?.api
      .ping()
      .then((response) => {
        setPingStatus('ok');
        setPingTimestamp(new Date(response.ts).toLocaleTimeString());
      })
      .catch(() => {
        setPingStatus('error');
        setPingTimestamp('');
      });
  }, []);

  return (
    <div className="app-frame">
      <header className="app-frame__header">
        <div className="header-brand">
          <div className="brand-mark" aria-hidden />
          <div className="brand-meta">
            <span className="brand-title">Semantiqa</span>
            <span className="brand-subtitle">Local semantic explorer</span>
          </div>
        </div>
        <div className="header-status">
          <StatusBadge tone="neutral">
            <StatusBadgeLabel>Environment</StatusBadgeLabel>
            <StatusBadgeValue>{env}</StatusBadgeValue>
          </StatusBadge>
          <StatusBadge tone={pingStatus === 'ok' ? 'positive' : pingStatus === 'error' ? 'negative' : 'neutral'}>
            <StatusBadgeLabel>IPC</StatusBadgeLabel>
            <StatusBadgeValue>
              {pingStatus === 'pending' ? 'checking…' : pingStatus === 'ok' ? `ok @ ${pingTimestamp}` : 'error'}
            </StatusBadgeValue>
          </StatusBadge>
        </div>
      </header>
      <ExplorerShell />
    </div>
  );
}
