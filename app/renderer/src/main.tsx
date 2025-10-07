import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './ui/App';
import './ui/global.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Renderer root element not found');
}

const root = createRoot(container);

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);

