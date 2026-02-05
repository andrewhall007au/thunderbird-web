import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for PRODUCTION testing
 *
 * This config is used for post-deployment smoke tests.
 * Targets actual production URL with real user scenarios.
 */
export default defineConfig({
  testDir: './',
  testMatch: 'critical-flows.spec.ts',

  // Longer timeouts for production
  timeout: 60_000,

  // No retries - we want to know if it fails once
  retries: 0,

  // Run tests in parallel for speed
  workers: 3,

  // Reporter for CI/CD
  reporter: [
    ['list'], // Console output
    ['json', { outputFile: 'test-results/production-results.json' }],
    ['html', { outputFolder: 'test-results/production-html', open: 'never' }]
  ],

  use: {
    // Target production
    baseURL: process.env.TEST_URL || 'https://thunderbird.bot',

    // Headless for CI
    headless: true,

    // Timeouts
    actionTimeout: 15_000,
    navigationTimeout: 30_000,

    // Capture evidence on failure
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Test on multiple browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile testing
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
  ],
});
