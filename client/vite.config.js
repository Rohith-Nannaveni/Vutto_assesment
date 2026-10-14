import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the API and Socket.IO are proxied so cookies are first-party (no CORS needed locally).
const target = process.env.VITE_DEV_API_TARGET || 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target, changeOrigin: false },
      '/socket.io': { target, ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
  },
});
