import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  root: './src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@semantiqa/app-config': path.resolve(__dirname, '../config/src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: 'localhost',
    cors: false,
  },
});

