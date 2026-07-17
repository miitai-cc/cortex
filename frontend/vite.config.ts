import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Read SERVER_PORT from backend/.env ──────────────────────────
function readBackendPort(): number {
  const envFile = path.resolve(__dirname, '../backend/.env');
  try {
    const content = fs.readFileSync(envFile, 'utf-8');
    const match = content.match(/^SERVER_PORT\s*=\s*(\d+)/m);
    if (match) return parseInt(match[1], 10);
  } catch {
    // file not found – fall through to default
  }
  return 54322; // default fallback
}

const BACKEND_PORT = readBackendPort();

export default defineConfig({
  plugins: [react()],
  base: './',
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
        target: `http://localhost:${BACKEND_PORT}`,
        changeOrigin: true,
      },
      '/cortex/ws': {
        target: `ws://localhost:${BACKEND_PORT}`,
        ws: true,
      },
    },
  },
});
