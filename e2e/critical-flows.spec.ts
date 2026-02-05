import { test, expect, Page } from '@playwright/test';

/**
 * CRITICAL USER FLOWS - E2E Tests
 *
 * These tests verify that core user journeys work end-to-end.
 * Run against PRODUCTION after every deployment.
 *
 * If ANY of these fail, the deployment should be rolled back.
 */

// Test configuration
const PRODUCTION_URL = process.env.TEST_URL || 'https://thunderbird.bot';
const TEST_EMAIL = `test-${Date.now()}@example.com`;

test.describe('Critical User Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Set longer timeout for production tests
    test.setTimeout(60000);
  });

  test('1. Homepage loads correctly', async ({ page }) => {
    await page.goto(PRODUCTION_URL);

    // Check key elements exist
    await expect(page.locator('text=Thunderbird')).toBeVisible();
    await expect(page.locator('text=Apply for Beta')).toBeVisible();

    // No console errors (excluding known warnings)
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.waitForTimeout(2000);

    // Filter out expected warnings
    const criticalErrors = errors.filter(e =>
      !e.includes('NEXT_PUBLIC_API_URL') &&
      !e.includes('favicon')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('2. Beta signup flow works', async ({ page }) => {
    await page.goto(PRODUCTION_URL);

    // Click Apply for Beta button
    await page.click('text=Apply for Beta');

    // Wait for modal to appear
    await expect(page.locator('text=Apply for Beta Access')).toBeVisible({ timeout: 5000 });

    // Fill out form
    await page.fill('input[type="text"]', 'E2E Test User');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.selectOption('select', 'Australia');

    // Submit form
    await page.click('button[type="submit"]');

    // CRITICAL: Should NOT see "Network error"
    await expect(page.locator('text=Network error')).not.toBeVisible({ timeout: 5000 });

    // Should see success message
    await expect(page.locator('text=Application Received')).toBeVisible({ timeout: 10000 });

    // Should show the success message content
    await expect(page.locator('text=login details at your email')).toBeVisible();
  });

  test('3. API endpoints are reachable from frontend', async ({ page }) => {
    // Track network requests
    const apiRequests: string[] = [];
    const failedRequests: string[] = [];

    page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiRequests.push(request.url());
      }
    });

    page.on('requestfailed', request => {
      if (request.url().includes('/api/')) {
        failedRequests.push(request.url());
      }
    });

    await page.goto(PRODUCTION_URL);

    // Trigger beta signup to test API
    await page.click('text=Apply for Beta');
    await page.fill('input[type="text"]', 'API Test User');
    await page.fill('input[type="email"]', `api-test-${Date.now()}@example.com`);
    await page.selectOption('select', 'Australia');
    await page.click('button[type="submit"]');

    // Wait for API call to complete
    await page.waitForTimeout(3000);

    // Verify API was called
    expect(apiRequests.some(url => url.includes('/api/beta/apply'))).toBeTruthy();

    // CRITICAL: No API requests should fail
    expect(failedRequests).toHaveLength(0);
  });

  test('4. No CSP violations on critical pages', async ({ page }) => {
    const cspViolations: string[] = [];

    page.on('console', msg => {
      if (msg.text().includes('Content Security Policy')) {
        cspViolations.push(msg.text());
      }
    });

    // Test homepage
    await page.goto(PRODUCTION_URL);
    await page.waitForTimeout(2000);

    // Test beta modal
    await page.click('text=Apply for Beta');
    await page.waitForTimeout(2000);

    // Filter out known/acceptable CSP violations (like map tiles)
    const criticalViolations = cspViolations.filter(v =>
      v.includes('localhost') || // localhost should NEVER appear
      v.includes('/api/') // API calls should work
    );

    expect(criticalViolations).toHaveLength(0);
  });

  test('5. Forms can submit without JavaScript errors', async ({ page }) => {
    const jsErrors: string[] = [];

    page.on('pageerror', error => {
      jsErrors.push(error.message);
    });

    await page.goto(PRODUCTION_URL);

    // Test beta form submission
    await page.click('text=Apply for Beta');
    await page.fill('input[type="text"]', 'Error Test User');
    await page.fill('input[type="email"]', `error-test-${Date.now()}@example.com`);
    await page.selectOption('select', 'Australia');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(3000);

    // CRITICAL: No JavaScript errors during form submission
    expect(jsErrors).toHaveLength(0);
  });
});

test.describe('Performance & Loading', () => {
  test('6. Page loads within reasonable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(PRODUCTION_URL);
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Page should load in under 10 seconds on production
    expect(loadTime).toBeLessThan(10000);
  });

  test('7. Critical resources load successfully', async ({ page }) => {
    const failedResources: string[] = [];

    page.on('response', response => {
      if (!response.ok() && response.status() !== 404) { // Ignore 404s like favicon
        failedResources.push(`${response.url()} - ${response.status()}`);
      }
    });

    await page.goto(PRODUCTION_URL);
    await page.waitForLoadState('networkidle');

    // Filter out acceptable failures
    const criticalFailures = failedResources.filter(r =>
      !r.includes('favicon') &&
      !r.includes('analytics') // Analytics can fail without breaking the site
    );

    expect(criticalFailures).toHaveLength(0);
  });
});
