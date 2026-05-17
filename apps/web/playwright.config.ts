import { defineConfig, devices } from '@playwright/test'

// E2E config. Targets the already-running dev server and Runbook backend.
//   - Runbook web:    http://localhost:3007
//   - Runbook server: http://localhost:3001
//   - cworld-be:      http://127.0.0.1:4000  (the API we're documenting)
//
// Run:
//   pnpm --filter @runbook/web exec playwright test --headed
//   pnpm --filter @runbook/web exec playwright test --ui

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:3007',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
