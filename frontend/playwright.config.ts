import { defineConfig, devices } from '@playwright/test';

// Pruebas E2E con la API simulada (page.route): corren solo con el servidor de Vite.
// Las del stack real (Docker) están en playwright.stack.config.ts.
export default defineConfig({
  testDir: './e2e',
  testIgnore: ['stack/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
    // CP-24: vista de celular en Chrome (Android) y Safari (iPhone).
    { name: 'android', use: { ...devices['Pixel 7'] } },
    { name: 'iphone', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
