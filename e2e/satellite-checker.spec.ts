import { test, expect } from '@playwright/test';

/**
 * SATELLITE COMPATIBILITY CHECKER - E2E Tests
 *
 * Tests the "Where it Works" satellite compatibility checker functionality.
 * Verifies that users get accurate availability information based on their
 * country, phone, and carrier selections.
 */

const PRODUCTION_URL = process.env.TEST_URL || 'https://thunderbird.bot';

test.describe('Satellite Compatibility Checker', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PRODUCTION_URL);

    // Scroll to the "Where it Works" section
    await page.locator('text=Where it works').scrollIntoViewIfNeeded();
  });

  test('1. Shows available status for US + iPhone + T-Mobile', async ({ page }) => {
    // Select USA
    await page.selectOption('select >> nth=0', 'US');

    // Select iPhone
    await page.click('text=iPhone 14 or newer');

    // Select T-Mobile
    await page.selectOption('select >> nth=1', 'T-Mobile');

    // Should show success message
    await expect(page.locator('text=Great news! You should be able to receive Thunderbird')).toBeVisible();

    // Should show Apple Satellite as available
    await expect(page.locator('text=Apple Satellite SMS')).toBeVisible();
    await expect(page.locator('text=Available — Your carrier supports SMS via satellite')).toBeVisible();

    // Should show Starlink D2C as available
    await expect(page.locator('text=Starlink Direct-to-Cell')).toBeVisible();

    // Should show iOS 18+ requirement note
    await expect(page.locator('text=Requires iPhone 14 or newer with iOS 18+')).toBeVisible();
  });

  test('2. Shows not available for unsupported carrier', async ({ page }) => {
    // Select USA
    await page.selectOption('select >> nth=0', 'US');

    // Select iPhone
    await page.click('text=iPhone 14 or newer');

    // Select Other US carrier
    await page.selectOption('select >> nth=1', 'Other US carrier');

    // Should show carrier not supported message
    await expect(page.locator('text=Not available — Your carrier hasn\'t enabled SMS via satellite yet')).toBeVisible();
  });

  test('3. Shows Mexico special case correctly', async ({ page }) => {
    // Select Mexico (in Limited group)
    await page.selectOption('select >> nth=0', 'MX');

    // Select iPhone
    await page.click('text=iPhone 14 or newer');

    // Select any carrier
    await page.selectOption('select >> nth=1', { index: 1 });

    // Should show Mexico special message
    await expect(page.locator('text=Apple satellite messaging exists in Mexico but no carriers have confirmed SMS gateway support')).toBeVisible();
  });

  test('4. Shows Australia Telstra as available, Optus as coming soon', async ({ page }) => {
    // Select Australia
    await page.selectOption('select >> nth=0', 'AU');

    // Select Android
    await page.click('text=Android');

    // Test Telstra (should be available)
    await page.selectOption('select >> nth=1', 'Telstra');
    await expect(page.locator('text=Great news! You should be able to receive')).toBeVisible();

    // Change to Optus (should be coming soon)
    await page.selectOption('select >> nth=1', 'Optus');
    await expect(page.locator('text=Coming 2026')).toBeVisible();
  });

  test('5. Shows Japan KDDI as unconfirmed', async ({ page }) => {
    // Select Japan (in Launching 2026 group)
    await page.selectOption('select >> nth=0', 'JP');

    // Select iPhone
    await page.click('text=iPhone 14 or newer');

    // Select KDDI
    await page.selectOption('select >> nth=1', 'KDDI (au)');

    // Should show unconfirmed status
    await expect(page.locator('text=Unconfirmed — Carrier satellite support is unclear')).toBeVisible();
  });

  test('6. Shows Android in countries without Apple Satellite', async ({ page }) => {
    // Select New Zealand (no Apple Satellite)
    await page.selectOption('select >> nth=0', 'NZ');

    // Select Android
    await page.click('text=Android');

    // Select One NZ (has Starlink)
    await page.selectOption('select >> nth=1', 'One NZ');

    // Should only show Starlink results, not Apple Satellite
    await expect(page.locator('text=Starlink Direct-to-Cell')).toBeVisible();
    await expect(page.locator('text=Apple Satellite SMS')).not.toBeVisible();
  });

  test('7. Shows older phone warning', async ({ page }) => {
    // Select any country
    await page.selectOption('select >> nth=0', 'US');

    // Select "Older phone / Not sure"
    await page.click('text=Older phone / Not sure');

    // Should show warning message
    await expect(page.locator('text=Your phone may not support satellite messaging')).toBeVisible();
  });

  test('8. Reset button clears selections', async ({ page }) => {
    // Make selections
    await page.selectOption('select >> nth=0', 'US');
    await page.click('text=iPhone 14 or newer');
    await page.selectOption('select >> nth=1', 'T-Mobile');

    // Wait for results to appear
    await expect(page.locator('text=Great news!')).toBeVisible();

    // Click "Start over" button
    await page.click('text=Start over');

    // Wait a moment for the reset
    await page.waitForTimeout(500);

    // Results should be hidden
    await expect(page.locator('text=Great news!')).not.toBeVisible();

    // Dropdowns should be reset
    const countrySelect = page.locator('select >> nth=0');
    await expect(countrySelect).toHaveValue('');
  });

  test('9. Country groupings are correct', async ({ page }) => {
    const countrySelect = page.locator('select >> nth=0');

    // Get all optgroups
    const availableNowGroup = countrySelect.locator('optgroup[label="Available now"]');
    const launching2026Group = countrySelect.locator('optgroup[label="Launching 2026"]');
    const limitedGroup = countrySelect.locator('optgroup[label="Limited"]');

    // Verify Available now includes correct countries
    await expect(availableNowGroup.locator('option[value="US"]')).toBeVisible();
    await expect(availableNowGroup.locator('option[value="AU"]')).toBeVisible();
    await expect(availableNowGroup.locator('option[value="CA"]')).toBeVisible();
    await expect(availableNowGroup.locator('option[value="NZ"]')).toBeVisible();
    await expect(availableNowGroup.locator('option[value="UA"]')).toBeVisible();

    // Verify Launching 2026 includes Japan
    await expect(launching2026Group.locator('option[value="JP"]')).toBeVisible();

    // Verify Limited includes Mexico
    await expect(limitedGroup.locator('option[value="MX"]')).toBeVisible();
  });

  test('10. Pricing displayed correctly', async ({ page }) => {
    // Check pricing in the hero section
    await expect(page.locator('text=$29.99 one-time')).toBeVisible();

    // Scroll to pricing section
    await page.locator('text=Simple pricing').scrollIntoViewIfNeeded();

    // Verify Thunderbird pricing
    await expect(page.locator('text=USD $29.99').first()).toBeVisible();
    await expect(page.locator('text=USD $0.33')).toBeVisible();
  });

  test('11. All new carriers are listed', async ({ page }) => {
    // Check New Zealand has all carriers
    await page.selectOption('select >> nth=0', 'NZ');
    await page.click('text=Android');

    const nzCarrierSelect = page.locator('select >> nth=1');
    await expect(nzCarrierSelect.locator('option[value="One NZ"]')).toBeVisible();
    await expect(nzCarrierSelect.locator('option[value="Spark"]')).toBeVisible();
    await expect(nzCarrierSelect.locator('option[value="2degrees"]')).toBeVisible();

    // Check Japan has all carriers
    await page.selectOption('select >> nth=0', 'JP');

    const jpCarrierSelect = page.locator('select >> nth=1');
    await expect(jpCarrierSelect.locator('option[value="KDDI (au)"]')).toBeVisible();
    await expect(jpCarrierSelect.locator('option[value="NTT Docomo"]')).toBeVisible();
    await expect(jpCarrierSelect.locator('option[value="SoftBank"]')).toBeVisible();
    await expect(jpCarrierSelect.locator('option[value="Rakuten Mobile"]')).toBeVisible();
  });
});

test.describe('Content Updates', () => {
  test('12. Text updates are displayed correctly', async ({ page }) => {
    await page.goto(PRODUCTION_URL);

    // Check main headlines
    await expect(page.locator('text=Introducing Thunderbird.')).toBeVisible();
    await expect(page.locator('text=Off grid hyper-detailed weather forecasts over SMS.')).toBeVisible();
    await expect(page.locator('text=Satellite SMS Support')).toBeVisible();
    await expect(page.locator('text=No Device Cost. No Lock in Contracts.')).toBeVisible();

    // Check GPS coordinates section
    await page.locator('text=How it works').scrollIntoViewIfNeeded();
    await expect(page.locator('text=Get GPS coordinates from your phone\'s compass app, Apple Maps, or Google Maps')).toBeVisible();
    await expect(page.locator('text=CAST12 -41.89, 146.08')).toBeVisible();
  });

  test('13. FAQ has updated pricing', async ({ page }) => {
    await page.goto(PRODUCTION_URL);

    // Scroll to FAQ
    await page.locator('text=Questions').scrollIntoViewIfNeeded();

    // Click on subscription question
    await page.click('text=Do I need a subscription?');

    // Check for updated pricing in answer
    await expect(page.locator('text=$29.99 in SMS credits')).toBeVisible();

    // Click on forecast cost question
    await page.click('text=How much does each forecast cost?');

    // Check for updated cost
    await expect(page.locator('text=USD $0.33')).toBeVisible();
    await expect(page.locator('text=approximately 90 forecasts')).toBeVisible();
  });
});
