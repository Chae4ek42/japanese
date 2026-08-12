import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { kuromojiDictPlugin } from './vite-plugin-kuromoji-dict'

export default defineConfig({
  plugins: [react(), kuromojiDictPlugin()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      // Аккаунты/прогресс живут в Cloudflare Worker (D1). Локально: `npm run dev:api`.
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
})
