import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        // Registro con el script que genera el plugin (sin workbox-window ni código propio).
        injectRegister: 'script-defer',
        includeAssets: ['icon.svg', 'apple-touch-icon.png'],
        manifest: {
          id: '/',
          name: 'Klyvon',
          short_name: 'Klyvon',
          description:
            'Precision in Every Move. Registro y verificación de limpieza de habitaciones para hoteles y alquileres vacacionales.',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait-primary',
          background_color: '#0A1D4A',
          theme_color: '#2F6FD6',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/fotos\//],
          // Sin runtimeCaching: los datos de la API y las fotos (URLs firmadas, datos de clientes)
          // no se guardan en la caché del service worker. Lo offline va por la cola de Dexie.
        },
        devOptions: {
          // Activo en desarrollo confunde las pruebas (sirve versiones viejas). Se prueba con `pnpm preview`.
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          rewrite: (ruta: string) => ruta.replace(/^\/api/, ''),
          cookiePathRewrite: { '/auth': '/api/auth' },
        },
        '/fotos': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'vendor-react',
                test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              },
              {
                name: 'vendor-router',
                test: /[\\/]node_modules[\\/]react-router[\\/]/,
              },
              {
                name: 'vendor-datos',
                test: /[\\/]node_modules[\\/](@tanstack|zod|i18next|react-i18next|lucide-react|dexie)[\\/]/,
              },
            ],
          },
        },
      },
    },
  };
});
