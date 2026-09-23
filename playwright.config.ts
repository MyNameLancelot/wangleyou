import { defineConfig, devices } from '@playwright/test';
const base = process.env.SITE_BASE || '/wangleyou/';
export default defineConfig({
  testDir: './tests',
  testMatch: '*.spec.ts',
  fullyParallel: true,
  retries: 0,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: `http://127.0.0.1:4173${base}`, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'], channel: 'chrome', viewport: { width: 360, height: 800 } } },
  ],
  webServer: { command: 'node scripts/serve-built.mjs', url: `http://127.0.0.1:4173${base}`, reuseExistingServer: !process.env.CI },
});
