import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vite 6.4+ blocks external hosts by default. Allow all for Render deployment.
  server: {
    allowedHosts: 'all',
  },
  preview: {
    allowedHosts: 'all',
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
});
