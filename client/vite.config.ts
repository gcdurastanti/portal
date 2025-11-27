import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';

export default defineConfig({
  plugins: [react(), basicSsl()],
  resolve: {
    alias: {
      '@portal/shared': path.resolve(__dirname, '../shared/src')
    }
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/livekit-rtc': {
        target: 'ws://localhost:7880',
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/livekit-rtc/, '')
      }
    }
  }
});
