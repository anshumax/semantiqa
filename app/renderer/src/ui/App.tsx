import { useEffect, useState } from 'react';
import { AppStateProvider } from './state';
import { StatusBadge, StatusBadgeLabel, StatusBadgeValue } from './components';
import { NavigationShell } from './navigation';
import { GlobalStatusBar } from './status/GlobalStatusBar';
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
      {/* <DevOverlay /> */}
    </AppStateProvider>
  );
}

function RootContent() {
  const [env, setEnv] = useState<string>('unknown');
  const [pingStatus, setPingStatus] = useState<'pending' | 'ok' | 'error'>('pending');
  const [pingTimestamp, setPingTimestamp] = useState<string>('');

  useEffect(() => {
    setEnv(process.env.NODE_ENV ?? 'unknown');

    console.log('Renderer booting; window.semantiqa =', window.semantiqa);

    const api = window.semantiqa?.api;

    if (!api) {
      console.error('preload bridge unavailable');
      setPingStatus('error');
      setPingTimestamp('preload unavailable');
      return;
    }

    api
      .ping()
      .then((response) => {
        console.log('Ping success', response);
        setPingStatus('ok');
        setPingTimestamp(new Date(response.ts).toLocaleTimeString());
      })
      .catch((error) => {
        console.error('Ping failed', error);
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
      <NavigationShell />
      <GlobalStatusBar />
    </div>
  );
}

function DevOverlay() {
  const [preloadAvailable, setPreloadAvailable] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const available = Boolean(window.semantiqa?.api);
    setPreloadAvailable(available);
    setLogs((prev) => [
      `renderer mounted at ${new Date().toISOString()}`,
      `preload available: ${available}`,
      ...prev.slice(0, 8),
    ]);

    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      setLogs((prev) => [`status event: ${JSON.stringify(detail)}`, ...prev.slice(0, 8)]);
    };

    window.addEventListener('sources:status', handler as EventListener);

    return () => {
      window.removeEventListener('sources:status', handler as EventListener);
    };
  }, []);

  return (
    <div className="dev-overlay">
      <h4>Debug</h4>
      <ul>
        <li>preload: {preloadAvailable ? 'yes' : 'no'}</li>
        {logs.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
