import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': process.env.VITE_API_TARGET || 'http://localhost:5000',
      '/socket.io': {
        target: process.env.VITE_API_TARGET || 'http://localhost:5000',
        ws: true,
      },
    },
  },
})