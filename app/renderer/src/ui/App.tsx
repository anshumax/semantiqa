import './App.css';

declare global {
  interface Window {
    semantiqa?: {
      api: {
        ping: () => string;
        getEnv: () => Record<string, string | undefined>;
      };
    };
  }
}

export default function App() {
  const env = window.semantiqa?.api.getEnv();
  const pingResult = window.semantiqa?.api.ping();

  return (
    <div className="app-shell">
      <header>
        <h1>Semantiqa Shell</h1>
        <p>Renderer sandboxed. IPC bridge ready.</p>
        <div className="status-panel">
          <span>{`ENV: ${env?.NODE_ENV ?? 'unknown'}`}</span>
          <span>{`PING: ${pingResult ?? 'unavailable'}`}</span>
        </div>
      </header>
    </div>
  );
}

