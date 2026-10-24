import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { pdfResources } from './build/pdfResources.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    pdfResources(),
    // vueDevTools 已移除：reportAllChanges/startTime 报错来自其注入的 overlay 脚本
  ],
  optimizeDeps: { include: ['pdfjs-dist', 'mammoth/mammoth.browser', 'dompurify'] },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://127.0.0.1:9050',
        changeOrigin: true,
      },
    },
  },
})
