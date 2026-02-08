import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for synthetic monitoring.
 *
 * This config is separate from the main playwright.config.ts used for development/CI.
 * It targets production with generous timeouts and JSON reporting for metric collection.
 */
export default defineConfig({
  // Test directory (same as main config)
  testDir: './',

  // Generous timeouts for production monitoring
  timeout: 120_000, // 120 seconds per test

  // No retries - monitoring should report actual state
  retries: 0,

  // Single worker to avoid parallel browser load on production
  workers: 1,

  // Reporter for monitoring - JSON output only
  reporter: [
    ['json', { outputFile: '/tmp/playwright-monitor-results.json' }]
  ],

  // Shared settings for all tests
  use: {
    // Always target production
    baseURL: process.env.BASE_URL || 'https://thunderbird.bot',

    // Run in headless mode
    headless: true,

    // Action timeout
    actionTimeout: 30_000,

    // Navigation timeout
    navigationTimeout: 30_000,

    // Trace only on failure
    trace: 'retain-on-failure',

    // Screenshot only on failure
    screenshot: 'only-on-failure',

    // Video only on failure
    video: 'retain-on-failure',
  },

  // Single project with Chromium only (lightweight)
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
