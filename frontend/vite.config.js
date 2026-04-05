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
    hmr: true,
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
