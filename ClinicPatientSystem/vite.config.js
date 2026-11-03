import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': process.env.VITE_API_TARGET || 'http://localhost:5001',
      '/socket.io': {
        target: process.env.VITE_API_TARGET || 'http://localhost:5001',
        ws: true,
      },
    },
  },
})