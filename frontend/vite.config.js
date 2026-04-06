import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'zustand', '@tanstack/react-query'],
  },
  server: {
    port: 5173,
    host: true,
    cors: true,
    allowedHosts: true,
    headers: {
      // Tell Cloudflare (and any CDN proxy) not to transform JS/CSS.
      // This prevents Rocket Loader and Auto-Minify from breaking React.
      'Cache-Control': 'no-store, no-transform',
    },
    hmr: {
      // When accessed via a Cloudflare tunnel the browser connects on 443,
      // but the Vite process listens on 5173.  clientPort bridges that gap.
      clientPort: 443,
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
