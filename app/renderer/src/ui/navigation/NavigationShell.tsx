import { useState, useCallback } from 'react';
import { ExplorerShell } from '../explorer';
import { ModelsScreen } from '../models';
import './NavigationShell.css';

type NavigationScreen = 'search-ask' | 'sources' | 'reports-dashboards';

export function NavigationShell() {
  const [activeScreen, setActiveScreen] = useState<NavigationScreen>('sources');

  const handleNavigate = useCallback((screen: NavigationScreen) => {
    setActiveScreen(screen);
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent, screen: NavigationScreen) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleNavigate(screen);
    }
  }, [handleNavigate]);

  return (
    <div className="navigation-shell">
      <nav className="navigation-shell__nav" role="navigation" aria-label="Main navigation">
        <ul className="nav-list">
          <li>
            <button
              type="button"
              className={`nav-item ${activeScreen === 'search-ask' ? 'nav-item--active' : ''}`}
              onClick={() => handleNavigate('search-ask')}
              onKeyDown={(e) => handleKeyDown(e, 'search-ask')}
              aria-current={activeScreen === 'search-ask' ? 'page' : undefined}
            >
              <span className="nav-item__icon" aria-hidden="true">🔍</span>
              <span className="nav-item__label">Search & Ask</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`nav-item ${activeScreen === 'sources' ? 'nav-item--active' : ''}`}
              onClick={() => handleNavigate('sources')}
              onKeyDown={(e) => handleKeyDown(e, 'sources')}
              aria-current={activeScreen === 'sources' ? 'page' : undefined}
            >
              <span className="nav-item__icon" aria-hidden="true">🎨</span>
              <span className="nav-item__label">Sources</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`nav-item ${activeScreen === 'reports-dashboards' ? 'nav-item--active' : ''}`}
              onClick={() => handleNavigate('reports-dashboards')}
              onKeyDown={(e) => handleKeyDown(e, 'reports-dashboards')}
              aria-current={activeScreen === 'reports-dashboards' ? 'page' : undefined}
            >
              <span className="nav-item__icon" aria-hidden="true">📊</span>
              <span className="nav-item__label">Reports & Dashboards</span>
            </button>
          </li>
        </ul>
      </nav>

      <main className="navigation-shell__content">
        {activeScreen === 'search-ask' && <SearchAskScreen />}
        {activeScreen === 'sources' && <CanvasWorkspaceScreen />}
        {activeScreen === 'reports-dashboards' && <ReportsDashboardsScreen />}
      </main>
    </div>
  );
}

// Placeholder screens for now
function SearchAskScreen() {
  return (
    <div className="placeholder-screen">
      <div className="placeholder-screen__content">
        <h1>Search & Ask</h1>
        <p>Natural language queries and semantic search will be implemented here.</p>
        <div className="placeholder-screen__features">
          <h2>Features (Coming Soon)</h2>
          <ul>
            <li>Natural language question input</li>
            <li>Federated query execution across sources</li>
            <li>Query plan visualization</li>
            <li>Results grid with export capabilities</li>
            <li>Save queries as reports</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function CanvasWorkspaceScreen() {
  return (
    <div className="placeholder-screen">
      <div className="placeholder-screen__content">
        <h1>Canvas Workspace</h1>
        <p>Unified canvas for data sources and relationships - inspired by n8n visual workflow design.</p>
        <div className="placeholder-screen__features">
          <h2>Canvas Features (Coming Soon)</h2>
          <ul>
            <li>Infinite canvas with dotted background</li>
            <li>Draggable data source blocks with status indicators</li>
            <li>Visual relationship connections with Bezier curves</li>
            <li>Double-click drill-down (sources → tables)</li>
            <li>n8n-style connection creation flow</li>
            <li>Floating UI elements (Plus button, mini-map, zoom controls)</li>
            <li>Auto-layout algorithms and manual positioning</li>
            <li>Canvas state persistence and export/import</li>
            <li>Real-time collaboration and change tracking</li>
          </ul>
        </div>
        <div style={{ marginTop: '2rem', padding: '1rem', border: '1px solid rgba(214, 216, 224, 0.12)', borderRadius: '8px' }}>
          <h3>Current Sources Explorer (Temporary)</h3>
          <p>The existing tree-based Sources explorer is shown below until the canvas is implemented:</p>
          <ExplorerShell />
        </div>
      </div>
    </div>
  );
}

function ReportsDashboardsScreen() {
  return (
    <div className="placeholder-screen">
      <div className="placeholder-screen__content">
        <h1>Reports & Dashboards</h1>
        <p>Saved reports and interactive dashboards will be managed here.</p>
        <div className="placeholder-screen__features">
          <h2>Features (Coming Soon)</h2>
          <ul>
            <li>Saved report library</li>
            <li>Dashboard composition and editing</li>
            <li>Automated refresh scheduling</li>
            <li>Visualization and charting</li>
            <li>Export to PDF and Excel</li>
          </ul>
        </div>
        
        {/* Demo the ModelsScreen here temporarily */}
        <div style={{ marginTop: '2rem', padding: '1rem', border: '1px solid rgba(214, 216, 224, 0.12)', borderRadius: '8px' }}>
          <h3>Model Manager (Preview)</h3>
          <p>The Model Manager is available for preview:</p>
          <ModelsScreen />
        </div>
      </div>
    </div>
  );
}