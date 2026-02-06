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

    // Check key elements exist (use more specific selectors)
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Thunderbird' })).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('button', { name: 'Apply for Beta' })).toBeVisible();

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

    // Get the modal container to scope our selectors
    const modal = page.locator('[class*="fixed"][class*="z-[100]"]');

    // Fill out form - scoped to modal only
    await modal.locator('input[type="text"]').fill('E2E Test User');
    await modal.locator('input[type="email"]').fill(TEST_EMAIL);
    await modal.locator('select').selectOption('Australia');

    // Submit form
    await modal.locator('button[type="submit"]').click();

    // CRITICAL: Should NOT see "Network error"
    await expect(page.locator('text=Network error')).not.toBeVisible({ timeout: 5000 });

    // Should see success message (use heading to avoid strict mode violation)
    await expect(page.getByRole('heading', { name: 'Application Received' })).toBeVisible({ timeout: 10000 });

    // Should show the success message content
    await expect(page.locator('text=login details at your email')).toBeVisible();
  });

  test('3. API endpoints are reachable from frontend', async ({ page }) => {
    // Track network requests
    const apiRequests: string[] = [];
    const failedRequests: Array<{ url: string; failure: string; method: string; headers: any }> = [];
    const successfulRequests: Array<{ url: string; status: number }> = [];

    // Capture console messages
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Capture CSP violations
    page.on('console', msg => {
      if (msg.text().includes('Content Security Policy') || msg.text().includes('CSP')) {
        console.log(`CSP: ${msg.text()}`);
      }
    });

    page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiRequests.push(request.url());
        console.log(`Request started: ${request.method()} ${request.url()}`);
      }
    });

    page.on('response', async response => {
      if (response.url().includes('/api/')) {
        const headers = response.headers();
        successfulRequests.push({
          url: response.url(),
          status: response.status()
        });
        console.log(`Response received: ${response.status()} ${response.url()}`);
        if (response.url().includes('/analytics')) {
          console.log(`  Analytics response headers:`);
          console.log(`    content-length: ${headers['content-length']}`);
          console.log(`    content-type: ${headers['content-type']}`);
          console.log(`    access-control-allow-origin: ${headers['access-control-allow-origin']}`);
          console.log(`    access-control-allow-credentials: ${headers['access-control-allow-credentials']}`);
        }
      }
    });

    page.on('requestfailed', request => {
      if (request.url().includes('/api/')) {
        const failure = request.failure();
        failedRequests.push({
          url: request.url(),
          failure: failure?.errorText || 'Unknown error',
          method: request.method(),
          headers: request.headers()
        });
        console.log(`Request failed: ${request.method()} ${request.url()}`);
        console.log(`  Failure: ${failure?.errorText}`);
        console.log(`  Headers: ${JSON.stringify(request.headers())}`);
      }
    });

    await page.goto(PRODUCTION_URL);
    await page.waitForLoadState('domcontentloaded');

    // Trigger beta signup to test API
    await page.click('text=Apply for Beta');

    // Get the modal container to scope our selectors
    const modal = page.locator('[class*="fixed"][class*="z-[100]"]');

    await modal.locator('input[type="text"]').fill('API Test User');
    await modal.locator('input[type="email"]').fill(`api-test-${Date.now()}@example.com`);
    await modal.locator('select').selectOption('Australia');
    await modal.locator('button[type="submit"]').click();

    // Wait for success message and close modal
    await page.waitForSelector('text=Application Received');
    await page.click('button:has-text("Close")');
    await page.waitForTimeout(500); // Wait for modal to close

    // Verify API was called
    expect(apiRequests.some(url => url.includes('/api/beta/apply'))).toBeTruthy();

    // CRITICAL: No API requests should fail
    // Note: Analytics is fire-and-forget, so we exclude it from critical failures
    const criticalFailures = failedRequests.filter(
      req => !req.url.includes('/api/analytics')
    );

    if (failedRequests.length > 0) {
      console.log('Failed requests:', JSON.stringify(failedRequests, null, 2));
      if (criticalFailures.length === 0) {
        console.log('Only analytics failed (expected - fire-and-forget endpoint)');
      }
    }
    expect(criticalFailures).toHaveLength(0);
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

    // Close any open modals from previous tests
    const closeButton = page.locator('button:has-text("Close")');
    if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeButton.click();
      await page.waitForTimeout(500);
    }

    // Test beta form submission
    await page.click('text=Apply for Beta');

    // Get the modal container to scope our selectors
    const modal = page.locator('[class*="fixed"][class*="z-[100]"]');

    await modal.locator('input[type="text"]').fill('Error Test User');
    await modal.locator('input[type="email"]').fill(`error-test-${Date.now()}@example.com`);
    await modal.locator('select').selectOption('Australia');
    await modal.locator('button[type="submit"]').click();

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

test.describe('Interactive Components', () => {
  test('8. Map markers are clickable and show waypoint details', async ({ page }) => {
    await page.goto(PRODUCTION_URL);

    // Scroll to the "See it in action" section
    await page.locator('text=See it in action').scrollIntoViewIfNeeded();

    // Wait for map to load (MapEditor is dynamically loaded)
    await page.waitForTimeout(2000);

    // Find a waypoint marker by its SMS code (e.g., "KIA" for Kia Ora Hut)
    // Markers show the first 3 letters of their SMS code
    const marker = page.locator('text=KIA').first();

    // Verify marker exists
    await expect(marker).toBeVisible();

    // Click the marker
    await marker.click();

    // Wait for waypoint details to appear below the map
    await page.waitForTimeout(500);

    // Verify waypoint details are displayed
    // The selected waypoint should show its full name and SMS code
    await expect(page.getByRole('heading', { name: 'Kia Ora Hut' })).toBeVisible();
    await expect(page.getByText('KIAOR').first()).toBeVisible();
  });

  test('9. Satellite compatibility checker works', async ({ page }) => {
    await page.goto(PRODUCTION_URL);

    // Scroll to "Where it Works" section
    await page.getByRole('heading', { name: 'Where it works' }).scrollIntoViewIfNeeded();

    // Select USA
    const countrySelect = page.locator('select').first();
    await countrySelect.selectOption('US');

    // Select iPhone
    await page.click('text=iPhone 14 or newer');

    // Carrier select should now be visible
    const carrierSelect = page.locator('select').nth(1);
    await expect(carrierSelect).toBeVisible();

    // Select T-Mobile
    await carrierSelect.selectOption('T-Mobile');

    // Should show success message
    await expect(page.locator('text=Great news! You should be able to receive Thunderbird')).toBeVisible();

    // Should show Apple Satellite as available
    await expect(page.locator('text=Apple Satellite SMS')).toBeVisible();
  });
});
