import { useState, useCallback } from 'react';
import { AppShell, NavLink, Stack } from '@mantine/core';
import { IconSearch, IconDatabase, IconChartBar } from '@tabler/icons-react';
import { ExplorerShell } from '../explorer';
import { ModelsScreen } from '../models';
import { CanvasWorkspace } from '../canvas';
import './NavigationShell.css';

type NavigationScreen = 'search-ask' | 'sources' | 'reports-dashboards';

export function NavigationShell() {
  const [activeScreen, setActiveScreen] = useState<NavigationScreen>('sources');

  const handleNavigate = useCallback((screen: NavigationScreen) => {
    setActiveScreen(screen);
  }, []);

  return (
    <>
      <AppShell.Navbar p="md">
        <Stack gap="xs">
          <NavLink
            label="Search & Ask"
            leftSection={<IconSearch size={18} stroke={1.5} />}
            active={activeScreen === 'search-ask'}
            onClick={() => handleNavigate('search-ask')}
          />
          <NavLink
            label="Sources"
            leftSection={<IconDatabase size={18} stroke={1.5} />}
            active={activeScreen === 'sources'}
            onClick={() => handleNavigate('sources')}
          />
          <NavLink
            label="Reports & Dashboards"
            leftSection={<IconChartBar size={18} stroke={1.5} />}
            active={activeScreen === 'reports-dashboards'}
            onClick={() => handleNavigate('reports-dashboards')}
          />
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        {activeScreen === 'search-ask' && <SearchAskScreen />}
        {activeScreen === 'sources' && <CanvasWorkspaceScreen />}
        {activeScreen === 'reports-dashboards' && <ReportsDashboardsScreen />}
      </AppShell.Main>
    </>
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
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CanvasWorkspace />
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