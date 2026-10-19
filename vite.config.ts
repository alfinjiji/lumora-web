import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'studio-admin-route',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (
            req.url?.split('?')[0] === '/admin' ||
            req.url?.startsWith('/admin/')
          )
            req.url = '/admin.html'
          next()
        })
      },
    },
  ],
  build: {
    rolldownOptions: { input: { main: 'index.html', admin: 'admin.html' } },
  },
  server: { proxy: { '/api': 'http://127.0.0.1:3001' } },
})
