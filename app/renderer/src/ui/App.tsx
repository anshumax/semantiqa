import { useEffect, useState } from 'react';
import './App.css';

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
  const [env, setEnv] = useState<string>('unknown');
  const [ping, setPing] = useState<string>('pending');

  useEffect(() => {
    setEnv(process.env.NODE_ENV ?? 'unknown');

    window.semantiqa?.api
      .ping()
      .then((response) => {
        setPing(`ok @ ${new Date(response.ts).toLocaleTimeString()}`);
      })
      .catch(() => setPing('error'));
  }, []);

  return (
    <div className="app-shell">
      <header>
        <h1>Semantiqa Shell</h1>
        <p>Renderer sandboxed. IPC bridge ready.</p>
        <div className="status-panel">
          <span>{`ENV: ${env}`}</span>
          <span>{`PING: ${ping}`}</span>
        </div>
      </header>
    </div>
  );
}

