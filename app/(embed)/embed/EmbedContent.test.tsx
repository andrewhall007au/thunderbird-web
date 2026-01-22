import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the lucide-react icons
jest.mock('lucide-react', () => ({
  Zap: () => <svg data-testid="zap-icon" />,
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

// Import the component after mocking
import EmbedContent from './EmbedContent';

describe('EmbedContent', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(<EmbedContent />);
      // Multiple "Thunderbird" elements exist (header + phone preview)
      expect(screen.getAllByText('Thunderbird').length).toBeGreaterThanOrEqual(1);
    });

    it('displays the logo', () => {
      render(<EmbedContent />);
      expect(screen.getByTestId('zap-icon')).toBeInTheDocument();
    });

    it('displays the headline', () => {
      render(<EmbedContent />);
      expect(screen.getByText('Alpine Weather via Satellite SMS')).toBeInTheDocument();
    });

    it('displays the subheadline', () => {
      render(<EmbedContent />);
      expect(screen.getByText('Professional forecasts for remote trails')).toBeInTheDocument();
    });

    it('renders a CTA button with correct link', () => {
      render(<EmbedContent />);
      const ctaLink = screen.getByRole('link', { name: /get started/i });
      expect(ctaLink).toBeInTheDocument();
      expect(ctaLink).toHaveAttribute('href', '/checkout?path=buy');
    });

    it('displays the correct price in CTA', () => {
      render(<EmbedContent />);
      expect(screen.getByText(/\$29\.99 USD/)).toBeInTheDocument();
    });
  });

  describe('Phone Preview Animation', () => {
    it('renders the phone preview container', () => {
      render(<EmbedContent />);
      // Phone preview shows the message interface with Thunderbird header
      const phoneHeaders = screen.getAllByText('Thunderbird');
      expect(phoneHeaders.length).toBe(2); // One in main header, one in phone preview
    });

    it('starts in typing phase', () => {
      render(<EmbedContent />);
      // In typing phase, cursor should be visible (animate-pulse class on span)
      const cursor = document.querySelector('.animate-pulse');
      expect(cursor).toBeInTheDocument();
    });

    it('types characters progressively', async () => {
      render(<EmbedContent />);

      // Initially should have cursor or first character
      const initialContent = screen.getByText(/\|/);
      expect(initialContent).toBeInTheDocument();

      // Advance timers to type some characters (80ms per character)
      act(() => {
        jest.advanceTimersByTime(80 * 5); // Type 5 characters
      });

      // Should now have "CAST1" typed
      await waitFor(() => {
        expect(screen.getByText(/CAST1/)).toBeInTheDocument();
      });
    });

    it('shows "Sending..." message after typing completes', async () => {
      render(<EmbedContent />);

      // Command is "CAST12 LAKEO" - 12 characters
      // Type all characters (80ms each) + transition to sending
      act(() => {
        jest.advanceTimersByTime(80 * 13); // Type all + one more tick
      });

      await waitFor(() => {
        expect(screen.getByText(/Sending via satellite/)).toBeInTheDocument();
      });
    });

    it('shows response after sending phase', async () => {
      render(<EmbedContent />);

      // Type all (80ms * 12) + sending phase (800ms) + a bit more
      act(() => {
        jest.advanceTimersByTime(80 * 13 + 800 + 100);
      });

      await waitFor(() => {
        // Response should contain the forecast
        expect(screen.getByText(/12hr forecast/)).toBeInTheDocument();
      });
    });

    it('loops back to typing after response', async () => {
      render(<EmbedContent />);

      // Full cycle: typing (80ms * 12) + sending (800ms) + response (4000ms) + a bit more
      act(() => {
        jest.advanceTimersByTime(80 * 13 + 800 + 4000 + 100);
      });

      await waitFor(() => {
        // Should be back in typing phase with cursor
        const cursor = document.querySelector('.animate-pulse');
        expect(cursor).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has accessible link', () => {
      render(<EmbedContent />);
      const link = screen.getByRole('link');
      expect(link).toBeInTheDocument();
    });

    it('uses semantic heading', () => {
      render(<EmbedContent />);
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Alpine Weather via Satellite SMS');
    });
  });
});
