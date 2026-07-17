import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@lib': path.resolve(__dirname, '../lib/react'),
    },
  },
  optimizeDeps: {
    include: ['eiva-fe-sso', 'eiva-fe-security'],
  },
  build: {
    outDir: '../backend/assets',
    emptyOutDir: true,
    commonjsOptions: {
      include: [/eiva-fe-sso/, /eiva-fe-security/, /node_modules/],
    },
  },
  server: {
    port: 54321,
    open: false,
    proxy: {
      '/cortex/api/v0.85': {
        target: 'http://localhost:54322',
        changeOrigin: true,
      },
      '/cortex/ws': {
        target: 'ws://localhost:54322',
        ws: true,
      },
    },
  },
});
