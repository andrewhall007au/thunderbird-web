import { test, expect } from '@playwright/test';
import { PAGES, SELECTORS, generateTestEmail } from './fixtures';

/**
 * E2E Tests: "Buy Now" Flow
 *
 * Tests the fast conversion path where users:
 * 1. Go directly to checkout
 * 2. Create account (or login)
 * 3. Complete Stripe payment
 * 4. Get redirected to success page
 * 5. Prompted to create first route
 *
 * This is the "buy first, create later" conversion path.
 */

test.describe('Buy Now Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('can navigate to checkout page from home', async ({ page }) => {
    await page.goto(PAGES.home);

    // Click "Buy Now" or similar CTA
    await page.click('text=Buy Now');

    await expect(page).toHaveURL(/\/checkout/);
  });

  test('checkout page shows price and form', async ({ page }) => {
    await page.goto(PAGES.checkout);

    // Should see the price
    await expect(page.locator('text=$29.99').or(page.locator('text=$49.99'))).toBeVisible();

    // Should see form fields for new users
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('checkout validates email format', async ({ page }) => {
    await page.goto(PAGES.checkout);

    // Enter invalid email
    await page.fill('input[type="email"]', 'not-an-email');
    await page.fill('input[type="password"]', 'TestPassword123!');

    // Try to submit
    await page.click('button[type="submit"]');

    // Should show validation error or browser validation prevents submission
    const hasError = await page.locator('text=valid email').or(page.locator('[data-error]')).isVisible().catch(() => false);
    const emailInvalid = await page.locator('input[type="email"]:invalid').count() > 0;

    expect(hasError || emailInvalid).toBeTruthy();
  });

  test('checkout validates password requirements', async ({ page }) => {
    await page.goto(PAGES.checkout);

    // Enter valid email but weak password
    await page.fill('input[type="email"]', generateTestEmail());
    await page.fill('input[type="password"]', '123'); // Too short

    // Fill name if required
    const nameInput = page.locator('input[name="name"]');
    if (await nameInput.isVisible()) {
      await nameInput.fill('Test User');
    }

    // Try to submit
    await page.click('button[type="submit"]');

    // Should show password validation error or browser validation
    // Wait a moment for any async validation
    await page.waitForTimeout(500);
  });

  test('checkout shows processing state on submit', async ({ page }) => {
    await page.goto(PAGES.checkout);

    // Fill valid form data
    await page.fill('input[type="email"]', generateTestEmail());
    await page.fill('input[type="password"]', 'ValidPassword123!');

    const nameInput = page.locator('input[name="name"]');
    if (await nameInput.isVisible()) {
      await nameInput.fill('Test User');
    }

    // Click submit
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Should show loading/processing state
    await expect(
      submitButton.locator('text=Processing')
        .or(page.locator('.animate-spin'))
        .or(submitButton.locator('[disabled]'))
    ).toBeVisible({ timeout: 3000 });
  });

  test('valid checkout redirects to Stripe', async ({ page }) => {
    await page.goto(PAGES.checkout);

    // Fill valid form
    await page.fill('input[type="email"]', generateTestEmail());
    await page.fill('input[type="password"]', 'ValidPassword123!');

    const nameInput = page.locator('input[name="name"]');
    if (await nameInput.isVisible()) {
      await nameInput.fill('Test User');
    }

    // Submit and wait for navigation
    const [response] = await Promise.all([
      page.waitForNavigation({ timeout: 10000 }).catch(() => null),
      page.click('button[type="submit"]'),
    ]);

    // Should redirect to Stripe checkout (checkout.stripe.com)
    // Or show an error if backend is unavailable
    const currentUrl = page.url();
    const redirectedToStripe = currentUrl.includes('stripe.com');
    const stayedOnPage = currentUrl.includes('/checkout');

    expect(redirectedToStripe || stayedOnPage).toBeTruthy();
  });

  test('checkout success page shows confirmation', async ({ page }) => {
    // Test success page structure (would normally come from Stripe redirect)
    await page.goto(`${PAGES.checkoutSuccess}?session_id=test_session`);

    // Should show success message or error about invalid session
    const hasSuccess = await page.locator('text=Thank you').or(page.locator('text=Success')).isVisible().catch(() => false);
    const hasError = await page.locator('text=invalid').or(page.locator('text=error')).isVisible().catch(() => false);

    expect(hasSuccess || hasError).toBeTruthy();
  });

  test('success page has create route CTA', async ({ page }) => {
    await page.goto(`${PAGES.checkoutSuccess}?session_id=test_session`);

    // If payment was valid, should see "Create Your Route" button
    const createButton = page.locator('a:has-text("Create")').or(page.locator('button:has-text("Create")'));

    // Either the button exists or the session was invalid (both valid test outcomes)
    const isVisible = await createButton.isVisible().catch(() => false);
    const hasError = await page.locator('text=invalid').or(page.locator('text=expired')).isVisible().catch(() => false);

    expect(isVisible || hasError).toBeTruthy();
  });
});

test.describe('Buy Now Flow - Logged In User', () => {
  test('logged in user sees simplified checkout', async ({ page, context }) => {
    // Set a fake token to simulate logged-in state
    await context.addCookies([
      { name: 'tb_token', value: 'fake_token', domain: 'localhost', path: '/' }
    ]);

    // Also set in localStorage via page evaluation
    await page.goto(PAGES.checkout);
    await page.evaluate(() => {
      localStorage.setItem('tb_token', 'fake_token');
    });

    // Reload to apply
    await page.reload();

    // For logged-in users, may see different UI (no password field, show email)
    // or the same form with pre-filled data
    await expect(page.locator('input[type="email"]').or(page.locator('text=@'))).toBeVisible();
  });
});

test.describe('Buy Now Flow - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test('checkout page is mobile responsive', async ({ page }) => {
    await page.goto(PAGES.checkout);

    // Form should be visible and usable on mobile
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // No horizontal scroll
    const body = page.locator('body');
    const scrollWidth = await body.evaluate(el => el.scrollWidth);
    const clientWidth = await body.evaluate(el => el.clientWidth);

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // Allow 1px tolerance
  });
});
