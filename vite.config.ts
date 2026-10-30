import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  server: {
    host: '0.0.0.0', port: 4173,
    allowedHosts: ['.e2b.app', 'localhost'],
    proxy: { '/control-api': { target: 'http://127.0.0.1:3000', changeOrigin: true, rewrite: path => path.replace(/^\/control-api/, '') } },
  },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: ['.e2b.app', 'localhost'] },
  build: {
    target: 'es2022',
    assetsDir: 'bundles',
    manifest: true,
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        help: resolve(import.meta.dirname, 'help.html'),
        maintenance: resolve(import.meta.dirname, 'maintenance.html'),
        notFound: resolve(import.meta.dirname, '404.html'),
        gallery: resolve(import.meta.dirname, 'beertjie.html'),
      }
    }
  }
});
