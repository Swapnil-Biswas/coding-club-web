import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, the frontend runs on 5173 and the backend on 3001. We proxy /api/*
// and /uploads/* through so the browser can use same-origin paths and the
// session cookie flows correctly. In prod, the backend serves the built
// frontend from the same origin and no proxy is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': { target: 'http://localhost:3001', changeOrigin: true },
      '/users': { target: 'http://localhost:3001', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});
