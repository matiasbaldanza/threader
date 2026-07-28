import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const SERVER_PORT = process.env['THREADER_SERVER_PORT'] ?? '5174'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Proxying keeps the app same-origin, so the local server needs no CORS headers
    // and stays as dumb as ADR-0005 wants it.
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${SERVER_PORT}`,
        changeOrigin: false,
      },
    },
  },
})
