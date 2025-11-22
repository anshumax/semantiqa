import { useState, useCallback } from 'react';
import { AppShell, NavLink, Stack } from '@mantine/core';
import { IconSearch, IconDatabase, IconChartBar, IconCpu } from '@tabler/icons-react';
import { ExplorerShell } from '../explorer';
import { ModelsScreen } from '../models';
import { CanvasWorkspace } from '../canvas';
import './NavigationShell.css';

type NavigationScreen = 'search-ask' | 'sources' | 'models' | 'reports-dashboards';

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
            label="Models"
            leftSection={<IconCpu size={18} stroke={1.5} />}
            active={activeScreen === 'models'}
            onClick={() => handleNavigate('models')}
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
        <div style={{ display: activeScreen === 'search-ask' ? 'block' : 'none', width: '100%', height: '100%' }}>
          <SearchAskScreen />
        </div>
        <div style={{ display: activeScreen === 'sources' ? 'block' : 'none', width: '100%', height: '100%' }}>
          <CanvasWorkspaceScreen />
        </div>
        <div style={{ display: activeScreen === 'models' ? 'block' : 'none', width: '100%', height: '100%' }}>
          <ModelsScreen />
        </div>
        <div style={{ display: activeScreen === 'reports-dashboards' ? 'block' : 'none', width: '100%', height: '100%' }}>
          <ReportsDashboardsScreen />
        </div>
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
      </div>
    </div>
  );
}