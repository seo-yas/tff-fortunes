import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 45_000,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4417', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  webServer: { command: 'node scripts/serve.mjs 4417', url: 'http://localhost:4417/', reuseExistingServer: true },
});
