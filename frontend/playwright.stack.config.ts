import { defineConfig, devices } from '@playwright/test';

// E2E contra el stack real de Docker (Caddy + API + PostgreSQL), con la PWA compilada.
//   docker compose up -d --build   y   docker compose run --rm migrate python -m scripts.semilla
//   E2E_URL=http://localhost E2E_CLAVE=<SEMILLA_CLAVE> pnpm test:e2e:stack
// La cámara se simula con el dispositivo falso de Chromium.
export default defineConfig({
  testDir: './e2e/stack',
  fullyParallel: false,
  workers: 1,
  // Lanzar Chromium con cámara falsa tarda en Windows; las pruebas en sí duran segundos.
  timeout: 90_000,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_URL ?? 'http://localhost',
    trace: 'retain-on-failure',
    serviceWorkers: 'allow',
    permissions: ['camera'],
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
  },
  projects: [{ name: 'android-stack', use: { ...devices['Pixel 7'] } }],
});
