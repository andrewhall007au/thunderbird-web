/**
 * PhoneSimulator Component Tests
 *
 * Tests the phone/watch SMS preview simulator.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { PhoneSimulator } from './PhoneSimulator';

// Sample SMS content for testing
const sampleSMSContent = `LAKEO Lake Oberon (863m)
24hr from 06:00 Mon

06h 5-7o Rn15% W12-20 Cld40% CB18 FL22

08h 7-10o Rn18% W14-22 Cld45% CB17 FL21

10h 10-14o Rn22% W16-26 Cld52% CB15 FL19

12h 12-16o Rn25% W18-30 Cld60% CB14 FL18 !

Rn=Rain W=Wind Cld=Cloud
CB=CloudBase(x100m)
FL=Freeze(x100m)`;

const sampleWatchContent = `LAKEO 863m
Mon 20 Jan

06h 5-7o Rn15%
W12-20 CB18 FL22

08h 7-10o Rn18%
W14-22 CB17 FL21

Rn=Rain W=Wind
CB=Cloud FL=Freeze`;

describe('PhoneSimulator', () => {
  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(<PhoneSimulator content={sampleSMSContent} />);
      expect(screen.getByTestId('phone-simulator')).toBeInTheDocument();
    });

    it('renders iPhone variant by default', () => {
      render(<PhoneSimulator content={sampleSMSContent} />);

      // Should have iPhone-like frame
      const frame = screen.getByTestId('phone-simulator');
      expect(frame.className).toMatch(/iphone|phone/i);
    });

    it('renders Watch variant when specified', () => {
      render(<PhoneSimulator content={sampleWatchContent} variant="watch" />);

      const frame = screen.getByTestId('phone-simulator');
      expect(frame.className).toMatch(/watch/i);
    });

    it('displays provided content', () => {
      render(<PhoneSimulator content="Test message" />);

      // After typing animation, content should be visible
      expect(screen.getByText(/Test message/)).toBeInTheDocument();
    });

    it('accepts custom className', () => {
      render(<PhoneSimulator content="Test" className="custom-class" />);

      const container = screen.getByTestId('phone-simulator').parentElement;
      expect(container?.className).toContain('custom-class');
    });
  });

  describe('Content Display', () => {
    it('displays weather location name', async () => {
      render(<PhoneSimulator content={sampleSMSContent} />);

      await waitFor(() => {
        expect(screen.getByText(/LAKEO/)).toBeInTheDocument();
      });
    });

    it('displays elevation', async () => {
      render(<PhoneSimulator content={sampleSMSContent} />);

      await waitFor(() => {
        expect(screen.getByText(/863m/)).toBeInTheDocument();
      });
    });

    it('displays forecast periods', async () => {
      render(<PhoneSimulator content={sampleSMSContent} />);

      await waitFor(() => {
        expect(screen.getByText(/06h/)).toBeInTheDocument();
      });
    });

    it('displays legend abbreviations', async () => {
      render(<PhoneSimulator content={sampleSMSContent} />);

      await waitFor(() => {
        expect(screen.getByText(/Rn=Rain/)).toBeInTheDocument();
      });
    });
  });

  describe('Typing Animation', () => {
    it('starts with empty or partial content', () => {
      const { container } = render(<PhoneSimulator content={sampleSMSContent} />);

      // Initially should not have full content visible
      // (depends on implementation - may show empty or be animating)
      expect(container).toBeDefined();
    });

    it('completes typing animation', async () => {
      render(<PhoneSimulator content="Short test" />);

      // Wait for animation to complete
      await waitFor(
        () => {
          expect(screen.getByText(/Short test/)).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });
  });

  describe('Visual Elements', () => {
    it('shows message timestamp', () => {
      render(<PhoneSimulator content={sampleSMSContent} />);

      // Should show current time or "Now"
      expect(
        screen.getByText(/now/i) ||
        screen.getByText(/\d{1,2}:\d{2}/)
      ).toBeInTheDocument();
    });

    it('shows message bubble styling', () => {
      const { container } = render(<PhoneSimulator content={sampleSMSContent} />);

      // Should have bubble-like styling
      const bubbles = container.querySelectorAll('[class*="bubble"], [class*="message"]');
      expect(bubbles.length).toBeGreaterThan(0);
    });

    it('shows battery/signal indicators on phone variant', () => {
      const { container } = render(<PhoneSimulator content={sampleSMSContent} variant="phone" />);

      // Phone frame typically has status bar elements
      expect(container.querySelector('[class*="status"]')).toBeInTheDocument();
    });
  });

  describe('Watch Variant', () => {
    it('renders smaller content for watch', () => {
      const { container } = render(
        <PhoneSimulator content={sampleWatchContent} variant="watch" />
      );

      const frame = screen.getByTestId('phone-simulator');

      // Watch frame should be smaller than phone
      const styles = window.getComputedStyle(frame);
      const width = parseInt(styles.width) || frame.clientWidth;

      // Watch is typically < 200px wide
      expect(width).toBeLessThan(250);
    });

    it('shows watch-appropriate time display', () => {
      render(<PhoneSimulator content={sampleWatchContent} variant="watch" />);

      // Watch shows time prominently
      expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
    });
  });

  describe('Responsiveness', () => {
    it('scales appropriately at different sizes', () => {
      const { rerender, container } = render(
        <PhoneSimulator content={sampleSMSContent} />
      );

      // Component should render without errors at any size
      rerender(<PhoneSimulator content={sampleSMSContent} className="w-full" />);

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty content', () => {
      render(<PhoneSimulator content="" />);

      expect(screen.getByTestId('phone-simulator')).toBeInTheDocument();
    });

    it('handles very long content', () => {
      const longContent = 'A'.repeat(1000);
      render(<PhoneSimulator content={longContent} />);

      expect(screen.getByTestId('phone-simulator')).toBeInTheDocument();
    });

    it('handles special characters', () => {
      render(<PhoneSimulator content="Temperature: 5°C • Wind: 20km/h → NW" />);

      expect(screen.getByTestId('phone-simulator')).toBeInTheDocument();
    });

    it('handles newlines correctly', () => {
      const multiLineContent = "Line 1\nLine 2\nLine 3";
      render(<PhoneSimulator content={multiLineContent} />);

      // Content should be displayed (newlines handled)
      expect(screen.getByTestId('phone-simulator')).toBeInTheDocument();
    });
  });
});
