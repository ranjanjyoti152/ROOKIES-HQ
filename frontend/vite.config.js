import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
    cors: true,
    allowedHosts: true,
    // Fix HMR when accessed via a remote domain/proxy.
    // Without this, Vite tries to connect the WebSocket to localhost
    // instead of the actual host the user is on, causing constant full-page reloads.
    hmr: {
      clientPort: 443,      // use the proxy's HTTPS port
      protocol: 'wss',      // wss:// for HTTPS domains
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      '/api/ws': {
        target: 'ws://localhost:8001',
        ws: true,
      },
    },
  },
})
