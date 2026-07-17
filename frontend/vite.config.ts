import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@lib': path.resolve(__dirname, '../lib/react'),
    },
  },
  optimizeDeps: {
    include: ['eiva-fe-sso'],
  },
  build: {
    outDir: '../backend/assets',
    emptyOutDir: true,
    commonjsOptions: {
      include: [/eiva-fe-sso/, /node_modules/],
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/cortex/api/v0.85': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/cortex/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },
    },
  },
});
