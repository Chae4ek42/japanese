import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sharedAppStatePlugin } from './vite-plugin-shared-app-state'

export default defineConfig({
  plugins: [react(), sharedAppStatePlugin()],
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
})
