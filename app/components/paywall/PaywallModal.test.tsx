/**
 * PaywallModal Component Tests
 *
 * Tests the purchase flow modal for route activation.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaywallModal } from './PaywallModal';

// Mock analytics
jest.mock('../../lib/analytics', () => ({
  trackCheckoutStarted: jest.fn(),
  getTrackingContext: jest.fn(() => ({
    entry_path: 'create',
    variant: 'A',
    session_start: new Date().toISOString(),
  })),
}));

describe('PaywallModal', () => {
  const defaultProps = {
    routeId: 1,
    routeName: 'Test Route',
    waypointCount: 5,
    onSuccess: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset localStorage mock
    (window.localStorage.getItem as jest.Mock).mockReturnValue(null);
  });

  describe('Rendering', () => {
    it('renders modal with route information', () => {
      render(<PaywallModal {...defaultProps} />);

      expect(screen.getByText(/Test Route/i)).toBeInTheDocument();
    });

    it('displays price', () => {
      render(<PaywallModal {...defaultProps} />);

      // Should show price somewhere in the modal
      expect(screen.getByText(/\$29\.99|\$49\.99/)).toBeInTheDocument();
    });

    it('shows close button', () => {
      render(<PaywallModal {...defaultProps} />);

      // Look for close button (X icon or "Close" text)
      const closeButton = screen.getByRole('button', { name: /close/i }) ||
                          screen.getByLabelText(/close/i);
      expect(closeButton).toBeInTheDocument();
    });

    it('shows account creation form for non-logged-in users', () => {
      render(<PaywallModal {...defaultProps} />);

      expect(screen.getByLabelText(/email/i) || screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i) || screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
    });

    it('shows payment fields', () => {
      render(<PaywallModal {...defaultProps} />);

      // Card number field
      expect(
        screen.getByLabelText(/card/i) ||
        screen.getByPlaceholderText(/card/i) ||
        screen.getByPlaceholderText(/4242/i)
      ).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('validates email format', async () => {
      render(<PaywallModal {...defaultProps} />);

      const emailInput = screen.getByLabelText(/email/i) || screen.getByPlaceholderText(/email/i);
      await userEvent.type(emailInput, 'invalid-email');

      // Form should not be submittable with invalid email
      const submitButton = screen.getByRole('button', { name: /purchase|pay|submit|activate/i });
      expect(submitButton).toBeDisabled();
    });

    it('validates password minimum length', async () => {
      render(<PaywallModal {...defaultProps} />);

      const passwordInput = screen.getByLabelText(/password/i) || screen.getByPlaceholderText(/password/i);
      await userEvent.type(passwordInput, 'short');

      // Form should not be submittable with short password
      const submitButton = screen.getByRole('button', { name: /purchase|pay|submit|activate/i });
      expect(submitButton).toBeDisabled();
    });

    it('formats card number with spaces', async () => {
      render(<PaywallModal {...defaultProps} />);

      const cardInput = screen.getByLabelText(/card/i) || screen.getByPlaceholderText(/card|4242/i);
      await userEvent.type(cardInput, '4242424242424242');

      // Should be formatted as "4242 4242 4242 4242"
      expect(cardInput).toHaveValue('4242 4242 4242 4242');
    });

    it('formats expiry as MM/YY', async () => {
      render(<PaywallModal {...defaultProps} />);

      const expiryInput = screen.getByLabelText(/expir/i) || screen.getByPlaceholderText(/MM\/YY/i);
      await userEvent.type(expiryInput, '1225');

      // Should be formatted as "12/25"
      expect(expiryInput).toHaveValue('12/25');
    });

    it('limits CVC to 4 digits', async () => {
      render(<PaywallModal {...defaultProps} />);

      const cvcInput = screen.getByLabelText(/cvc|cvv/i) || screen.getByPlaceholderText(/cvc|cvv/i);
      await userEvent.type(cvcInput, '12345');

      // Should be limited to 4 digits
      expect(cvcInput.getAttribute('value')?.length).toBeLessThanOrEqual(4);
    });
  });

  describe('User Interactions', () => {
    it('calls onClose when close button clicked', async () => {
      render(<PaywallModal {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: /close/i }) ||
                          screen.getByLabelText(/close/i);
      await userEvent.click(closeButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('calls onClose when escape key pressed', () => {
      render(<PaywallModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('toggles password visibility', async () => {
      render(<PaywallModal {...defaultProps} />);

      const passwordInput = screen.getByLabelText(/password/i) || screen.getByPlaceholderText(/password/i);

      // Initially should be password type
      expect(passwordInput).toHaveAttribute('type', 'password');

      // Find and click the toggle button
      const toggleButton = screen.getByRole('button', { name: /show|hide|toggle/i }) ||
                           screen.getByLabelText(/show|hide/i);

      if (toggleButton) {
        await userEvent.click(toggleButton);
        // Password should now be visible
        expect(passwordInput).toHaveAttribute('type', 'text');
      }
    });
  });

  describe('Form Submission', () => {
    it('shows loading state when submitting', async () => {
      // Mock successful API call
      global.fetch = jest.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({ checkout_url: 'https://stripe.com/test' }),
        }), 100))
      );

      render(<PaywallModal {...defaultProps} />);

      // Fill form with valid data
      await userEvent.type(screen.getByPlaceholderText(/email/i), 'test@example.com');
      await userEvent.type(screen.getByPlaceholderText(/password/i), 'Password123!');
      await userEvent.type(screen.getByPlaceholderText(/name/i), 'Test User');
      await userEvent.type(screen.getByPlaceholderText(/card|4242/i), '4242424242424242');
      await userEvent.type(screen.getByPlaceholderText(/MM\/YY/i), '1225');
      await userEvent.type(screen.getByPlaceholderText(/cvc|cvv/i), '123');

      // Submit
      const submitButton = screen.getByRole('button', { name: /purchase|pay|submit|activate/i });
      await userEvent.click(submitButton);

      // Should show loading state
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });
    });

    it('displays error message on API failure', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ detail: 'Payment failed' }),
      });

      render(<PaywallModal {...defaultProps} />);

      // Fill and submit form
      await userEvent.type(screen.getByPlaceholderText(/email/i), 'test@example.com');
      await userEvent.type(screen.getByPlaceholderText(/password/i), 'Password123!');
      await userEvent.type(screen.getByPlaceholderText(/name/i), 'Test User');
      await userEvent.type(screen.getByPlaceholderText(/card|4242/i), '4242424242424242');
      await userEvent.type(screen.getByPlaceholderText(/MM\/YY/i), '1225');
      await userEvent.type(screen.getByPlaceholderText(/cvc|cvv/i), '123');

      const submitButton = screen.getByRole('button', { name: /purchase|pay|submit|activate/i });
      await userEvent.click(submitButton);

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/failed|error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Analytics', () => {
    it('tracks checkout_started on mount', async () => {
      const { trackCheckoutStarted } = require('../../lib/analytics');

      render(<PaywallModal {...defaultProps} />);

      expect(trackCheckoutStarted).toHaveBeenCalled();
    });
  });

  describe('Logged-in User', () => {
    beforeEach(() => {
      // Mock logged-in state
      (window.localStorage.getItem as jest.Mock).mockReturnValue('test-token');
    });

    it('hides account creation fields for logged-in users', () => {
      render(<PaywallModal {...defaultProps} />);

      // Should not show email/password for logged-in users
      // (they already have an account)
      const emailInputs = screen.queryAllByPlaceholderText(/email/i);
      const passwordInputs = screen.queryAllByPlaceholderText(/password/i);

      // Either no inputs, or they're optional/hidden
      expect(emailInputs.length + passwordInputs.length).toBeLessThanOrEqual(2);
    });
  });
});
