/**
 * E2E Test Fixtures
 *
 * Shared test data and utilities for Playwright E2E tests.
 */

// Test user credentials
export const TEST_USER = {
  email: `e2e-test-${Date.now()}@example.com`,
  password: 'TestPassword123!',
  name: 'E2E Test User',
};

// Existing test user (for logged-in tests)
export const EXISTING_USER = {
  email: 'e2e-existing@example.com',
  password: 'ExistingUser123!',
};

// Sample GPX file content for route creation
export const SAMPLE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="E2E Test">
  <trk>
    <name>Test Route</name>
    <trkseg>
      <trkpt lat="-42.8821" lon="146.0525"><ele>1200</ele></trkpt>
      <trkpt lat="-42.8831" lon="146.0535"><ele>1250</ele></trkpt>
      <trkpt lat="-42.8841" lon="146.0545"><ele>1300</ele></trkpt>
      <trkpt lat="-42.8851" lon="146.0555"><ele>1280</ele></trkpt>
      <trkpt lat="-42.8861" lon="146.0565"><ele>1220</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

// Test affiliate code (must exist in test database)
export const TEST_AFFILIATE = {
  code: 'TESTPARTNER',
  expectedDiscount: 10, // 10% discount
};

// API endpoints
export const API = {
  base: process.env.API_URL || 'http://localhost:8000',
  register: '/auth/register',
  login: '/auth/token',
  checkout: '/api/payments/checkout',
  buyNow: '/api/payments/buy-now',
  validateAffiliate: '/api/affiliate/validate',
};

// Page URLs
export const PAGES = {
  home: '/',
  create: '/create',
  preview: '/create/preview',
  checkout: '/checkout',
  checkoutSuccess: '/checkout/success',
  library: '/library',
  routes: '/routes',
  compatibility: '/compatibility',
};

// Selectors for common elements
export const SELECTORS = {
  // Navigation
  logo: '[data-testid="logo"]',
  navBuyNow: 'a:has-text("Buy Now")',
  navCreate: 'a:has-text("Create Route")',

  // Route creation
  gpxUpload: '[data-testid="gpx-upload"]',
  mapEditor: '[data-testid="map-editor"]',
  waypointList: '[data-testid="waypoint-list"]',
  saveButton: 'button:has-text("Save")',
  previewButton: 'button:has-text("Preview")',

  // Checkout
  emailInput: 'input[type="email"]',
  passwordInput: 'input[type="password"]',
  nameInput: 'input[name="name"]',
  submitButton: 'button[type="submit"]',

  // Paywall
  paywallModal: '[data-testid="paywall-modal"]',
  activateButton: 'button:has-text("Activate")',

  // Phone simulator
  phoneSimulator: '[data-testid="phone-simulator"]',

  // Success page
  successMessage: '[data-testid="success-message"]',
  createRouteButton: 'a:has-text("Create Your Route")',
};

/**
 * Generate a unique test email
 */
export function generateTestEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
}

/**
 * Create a GPX file blob for upload testing
 */
export function createGPXFile(content: string = SAMPLE_GPX): Buffer {
  return Buffer.from(content, 'utf-8');
}
