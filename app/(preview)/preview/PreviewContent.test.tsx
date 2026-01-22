import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the lucide-react icons
jest.mock('lucide-react', () => ({
  Smartphone: () => <svg data-testid="smartphone-icon" />,
  Tablet: () => <svg data-testid="tablet-icon" />,
  Monitor: () => <svg data-testid="monitor-icon" />,
}));

// Import the component after mocking
import PreviewContent from './PreviewContent';

describe('PreviewContent', () => {
  // Mock window dimensions
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1920,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 1080,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    });
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(<PreviewContent />);
      expect(screen.getByText('Phone')).toBeInTheDocument();
    });

    it('renders all three device buttons', () => {
      render(<PreviewContent />);
      expect(screen.getByText('Phone')).toBeInTheDocument();
      expect(screen.getByText('Tablet')).toBeInTheDocument();
      expect(screen.getByText('Laptop')).toBeInTheDocument();
    });

    it('displays device dimensions in buttons', () => {
      render(<PreviewContent />);
      expect(screen.getByText('375x812')).toBeInTheDocument();
      expect(screen.getByText('768x1024')).toBeInTheDocument();
      expect(screen.getByText('1440x900')).toBeInTheDocument();
    });

    it('renders an iframe with embed source', () => {
      render(<PreviewContent />);
      const iframe = screen.getByTitle('Phone Preview');
      expect(iframe).toBeInTheDocument();
      expect(iframe).toHaveAttribute('src', '/embed');
    });

    it('shows current dimensions in footer', () => {
      render(<PreviewContent />);
      expect(screen.getByText(/375 x 812/)).toBeInTheDocument();
    });
  });

  describe('Device Switching', () => {
    it('phone is selected by default', () => {
      render(<PreviewContent />);
      const phoneButton = screen.getByText('Phone').closest('button');
      expect(phoneButton).toHaveClass('bg-orange-500');
    });

    it('switches to tablet when tablet button is clicked', () => {
      render(<PreviewContent />);

      const tabletButton = screen.getByText('Tablet').closest('button');
      fireEvent.click(tabletButton!);

      expect(tabletButton).toHaveClass('bg-orange-500');
      expect(screen.getByTitle('Tablet Preview')).toBeInTheDocument();
      expect(screen.getByText(/768 x 1024/)).toBeInTheDocument();
    });

    it('switches to laptop when laptop button is clicked', () => {
      render(<PreviewContent />);

      const laptopButton = screen.getByText('Laptop').closest('button');
      fireEvent.click(laptopButton!);

      expect(laptopButton).toHaveClass('bg-orange-500');
      expect(screen.getByTitle('Laptop Preview')).toBeInTheDocument();
      expect(screen.getByText(/1440 x 900/)).toBeInTheDocument();
    });

    it('updates iframe title when device changes', () => {
      render(<PreviewContent />);

      expect(screen.getByTitle('Phone Preview')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Tablet').closest('button')!);
      expect(screen.getByTitle('Tablet Preview')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Laptop').closest('button')!);
      expect(screen.getByTitle('Laptop Preview')).toBeInTheDocument();
    });

    it('deselects previous device when new device is selected', () => {
      render(<PreviewContent />);

      const phoneButton = screen.getByText('Phone').closest('button');
      const tabletButton = screen.getByText('Tablet').closest('button');

      // Phone should be selected initially
      expect(phoneButton).toHaveClass('bg-orange-500');
      expect(tabletButton).not.toHaveClass('bg-orange-500');

      // Click tablet
      fireEvent.click(tabletButton!);

      // Tablet should be selected, phone deselected
      expect(tabletButton).toHaveClass('bg-orange-500');
      expect(phoneButton).not.toHaveClass('bg-orange-500');
    });
  });

  describe('Scale Calculation', () => {
    it('calculates scale based on window size', () => {
      render(<PreviewContent />);
      // With 1920x1080 window and phone (375x812), scale should be calculated
      // maxWidth = 1920 - 100 = 1820
      // maxHeight = 1080 - 180 = 900
      // scale = min(1820/375, 900/812, 1) = min(4.85, 1.11, 1) = 1
      expect(screen.getByText(/100% scale/)).toBeInTheDocument();
    });

    it('updates scale when device changes', async () => {
      render(<PreviewContent />);

      // Switch to laptop (1440x900)
      fireEvent.click(screen.getByText('Laptop').closest('button')!);

      // With 1920x1080 window and laptop (1440x900)
      // maxWidth = 1820, maxHeight = 900
      // scale = min(1820/1440, 900/900, 1) = min(1.26, 1, 1) = 1
      await waitFor(() => {
        expect(screen.getByText(/100% scale/)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('all buttons are keyboard accessible', () => {
      render(<PreviewContent />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBe(3);
      buttons.forEach(button => {
        expect(button).not.toHaveAttribute('tabindex', '-1');
      });
    });

    it('iframe has descriptive title', () => {
      render(<PreviewContent />);
      const iframe = screen.getByTitle('Phone Preview');
      expect(iframe).toHaveAttribute('title');
    });
  });
});
