import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: { alias: {
    'node:buffer': 'buffer',
    'tikzjax-tex': fileURLToPath(new URL('./node_modules/isomorphic-tikzjax/dist/bootstrap.js', import.meta.url)),
  } },
  worker: { format: 'es' },
  server: {
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
})
