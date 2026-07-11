import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true,
    host: '0.0.0.0',
    hmr: {
      clientPort: 443,
      protocol: 'wss',
    },
  },
  preview: {
    allowedHosts: true,
    host: '0.0.0.0',
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
});
