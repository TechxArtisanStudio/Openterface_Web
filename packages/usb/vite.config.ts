import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import fs from 'fs'

const useHttps = fs.existsSync('./server.key') && fs.existsSync('./server.crt')

export default defineConfig({
  plugins: [vue()],
  base: '/Openterface_Web/',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'esnext',
    assetsDir: 'assets',
  },
  server: {
    host: '0.0.0.0',
    ...(useHttps ? {
      https: {
        key: fs.readFileSync('./server.key'),
        cert: fs.readFileSync('./server.crt'),
      },
    } : {}),
  },
})
