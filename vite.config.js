// vite.config.js — وب (PWA) از طریق react-native-web
import { cpSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    {
      // manifest.json (در web/) هنگام build کنار خروجی کپی می‌شود تا PWA نصب‌پذیر باشد.
      name: 'copy-manifest',
      closeBundle() {
        cpSync(
          fileURLToPath(new URL('./web/manifest.json', import.meta.url)),
          fileURLToPath(new URL('./dist/manifest.json', import.meta.url)),
        )
      },
    },
  ],
  server: { port: 5173, open: '/web/index.html' },
  build: {
    outDir: 'dist',
    rollupOptions: { input: fileURLToPath(new URL('./web/index.html', import.meta.url)) },
  },
})