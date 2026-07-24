import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev proxy sends /auth and /api to the server so cookies stay first-party.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:3000',
      '/api': 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
