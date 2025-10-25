import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';

import App from './ui/App';
import { theme } from './ui/theme';

// Import Mantine styles
import '@mantine/core/styles.css';
import './ui/global.css';

if ((import.meta as any).env.DEV && !(window as any).semantiqa) {
  console.warn('[dev] Injecting mock semantiqa bridge for browser preview');
  (window as any).semantiqa = {
    api: {
      async invoke() {
        throw new Error('IPC bridge unavailable in browser mode');
      },
      async ping() {
        return { ok: false, ts: Date.now(), message: 'bridge unavailable' };
      },
    },
    bridge: {
      publish() {
        // noop
      },
    },
  };
}

const container = document.getElementById('root');

if (!container) {
  throw new Error('Renderer root element not found');
}

const root = createRoot(container);

root.render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <App />
    </MantineProvider>
  </StrictMode>,
);

