import { test, expect } from '@playwright/test';

test.describe('Beta Signup Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should complete beta signup successfully', async ({ page }) => {
    // Click the beta signup button on landing page
    await page.click('button:has-text("Apply for Beta")');

    // Wait for modal to appear
    await expect(page.locator('text=Apply for Beta Access')).toBeVisible();

    // Fill in the form
    await page.fill('input[type="text"]', 'Test User');
    await page.fill('input[type="email"]', `test-${Date.now()}@example.com`);
    await page.selectOption('select', 'Australia');

    // Wait for form validation to enable submit button
    await expect(page.locator('button:has-text("Submit Application")')).toBeEnabled({ timeout: 5000 });

    // Submit the form
    await page.click('button:has-text("Submit Application")');

    // Wait for success message
    await expect(page.locator('text=Application Received')).toBeVisible({ timeout: 10000 });

    // Verify success message contains expected text
    await expect(page.locator('text=/check your email|welcome to the beta|application received/i')).toBeVisible();
  });

  test('should show validation errors for invalid email', async ({ page }) => {
    await page.click('button:has-text("Apply for Beta")');

    await page.fill('input[type="text"]', 'Test User');
    await page.fill('input[type="email"]', 'invalid-email');
    await page.selectOption('select', 'Australia');

    // Submit button should be disabled for invalid email
    const submitButton = page.locator('button:has-text("Submit Application")');
    await expect(submitButton).toBeDisabled();
  });

  test('should require all fields to be filled', async ({ page }) => {
    await page.click('button:has-text("Apply for Beta")');

    const submitButton = page.locator('button:has-text("Submit Application")');

    // Initially disabled
    await expect(submitButton).toBeDisabled();

    // Fill name only
    await page.fill('input[type="text"]', 'Test User');
    await expect(submitButton).toBeDisabled();

    // Fill email
    await page.fill('input[type="email"]', 'test@example.com');
    await expect(submitButton).toBeDisabled();

    // Fill country - now should be enabled
    await page.selectOption('select', 'Australia');
    await expect(submitButton).not.toBeDisabled();
  });

  test('should close modal when X button is clicked', async ({ page }) => {
    await page.click('button:has-text("Apply for Beta")');

    await expect(page.locator('text=Apply for Beta Access')).toBeVisible();

    // Click the X button
    await page.click('button:has([class*="lucide-x"])');

    // Modal should disappear
    await expect(page.locator('text=Apply for Beta Access')).not.toBeVisible();
  });

  test('should close modal when Escape key is pressed', async ({ page }) => {
    await page.click('button:has-text("Apply for Beta")');

    await expect(page.locator('text=Apply for Beta Access')).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');

    // Modal should disappear
    await expect(page.locator('text=Apply for Beta Access')).not.toBeVisible();
  });

  test('should show error message for duplicate email', async ({ page }) => {
    const duplicateEmail = 'duplicate@example.com';

    // First submission
    await page.click('button:has-text("Apply for Beta")');
    await page.fill('input[type="text"]', 'First User');
    await page.fill('input[type="email"]', duplicateEmail);
    await page.selectOption('select', 'Australia');
    await expect(page.locator('button:has-text("Submit Application")')).toBeEnabled({ timeout: 5000 });
    await page.click('button:has-text("Submit Application")');

    // Wait for success or continue
    await page.waitForTimeout(2000);

    // Reload page and try again with same email
    await page.goto('/');
    await page.click('button:has-text("Apply for Beta")');
    await page.fill('input[type="text"]', 'Second User');
    await page.fill('input[type="email"]', duplicateEmail);
    await page.selectOption('select', 'Australia');
    await expect(page.locator('button:has-text("Submit Application")')).toBeEnabled({ timeout: 5000 });
    await page.click('button:has-text("Submit Application")');

    // Should show error (might be "already registered" or "already exists")
    await expect(page.locator('text=/already|duplicate/i')).toBeVisible({ timeout: 5000 });
  });

  test('should handle network errors gracefully', async ({ page, context }) => {
    // Intercept API call and force it to fail
    await page.route('**/api/beta/apply', route => route.abort());

    await page.click('button:has-text("Apply for Beta")');
    await page.fill('input[type="text"]', 'Test User');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.selectOption('select', 'Australia');
    await expect(page.locator('button:has-text("Submit Application")')).toBeEnabled({ timeout: 5000 });
    await page.click('button:has-text("Submit Application")');

    // Should show network error message
    await expect(page.locator('text=/Network error|connection/i')).toBeVisible({ timeout: 5000 });
  });

  test('should display all supported countries', async ({ page }) => {
    await page.click('button:has-text("Apply for Beta")');

    const countrySelect = page.locator('select');

    // Check for key supported countries
    const options = await countrySelect.locator('option').allTextContents();

    expect(options).toContain('Australia');
    expect(options).toContain('United States');
    expect(options).toContain('United Kingdom');
    expect(options).toContain('Canada');
  });

  test('should prevent body scroll when modal is open', async ({ page }) => {
    await page.click('button:has-text("Apply for Beta")');

    const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
    expect(bodyOverflow).toBe('hidden');
  });
});

test.describe('Beta Signup - Production Environment', () => {
  test('should use correct API endpoint on production', async ({ page }) => {
    // Track API calls
    const apiCalls: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/beta/apply')) {
        apiCalls.push(request.url());
      }
    });

    await page.goto('/');
    await page.click('button:has-text("Apply for Beta")');
    await page.fill('input[type="text"]', 'Test User');
    await page.fill('input[type="email"]', `test-${Date.now()}@example.com`);
    await page.selectOption('select', 'Australia');
    await expect(page.locator('button:has-text("Submit Application")')).toBeEnabled({ timeout: 5000 });
    await page.click('button:has-text("Submit Application")');

    // Wait for API call
    await page.waitForTimeout(2000);

    // Verify API call was made
    expect(apiCalls.length).toBeGreaterThan(0);

    // Verify it's not calling localhost (unless we're in dev mode)
    const calledLocalhost = apiCalls.some(url => url.includes('localhost'));

    // In production, should NOT call localhost
    if (process.env.NODE_ENV === 'production') {
      expect(calledLocalhost).toBe(false);
    }
  });
});
