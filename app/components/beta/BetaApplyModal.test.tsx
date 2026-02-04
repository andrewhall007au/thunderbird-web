import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BetaApplyModal } from './BetaApplyModal';

// Mock fetch globally
global.fetch = jest.fn();

describe('BetaApplyModal', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render modal with form fields', () => {
    render(<BetaApplyModal onClose={mockOnClose} />);

    expect(screen.getByText('Apply for Beta Access')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Country')).toBeInTheDocument();
  });

  it('should disable submit button when form is invalid', () => {
    render(<BetaApplyModal onClose={mockOnClose} />);

    const submitButton = screen.getByRole('button', { name: /submit application/i });
    expect(submitButton).toBeDisabled();
  });

  it('should enable submit button when form is valid', () => {
    render(<BetaApplyModal onClose={mockOnClose} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'Australia' } });

    const submitButton = screen.getByRole('button', { name: /submit application/i });
    expect(submitButton).not.toBeDisabled();
  });

  it('should use relative API URL when NEXT_PUBLIC_API_URL is not set', async () => {
    // Ensure env var is not set
    const originalEnv = process.env.NEXT_PUBLIC_API_URL;
    delete process.env.NEXT_PUBLIC_API_URL;

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: 'Application received' }),
    });

    render(<BetaApplyModal onClose={mockOnClose} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'Australia' } });

    const submitButton = screen.getByRole('button', { name: /submit application/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/beta/apply',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    // Restore env
    if (originalEnv) process.env.NEXT_PUBLIC_API_URL = originalEnv;
  });

  it('should use NEXT_PUBLIC_API_URL when set', async () => {
    const originalEnv = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000';

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: 'Application received' }),
    });

    render(<BetaApplyModal onClose={mockOnClose} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'Australia' } });

    const submitButton = screen.getByRole('button', { name: /submit application/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/beta/apply',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    // Restore env
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_API_URL = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_API_URL;
    }
  });

  it('should show success message on successful submission', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: 'Welcome to the beta!' }),
    });

    render(<BetaApplyModal onClose={mockOnClose} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'Australia' } });

    fireEvent.click(screen.getByRole('button', { name: /submit application/i }));

    await waitFor(() => {
      expect(screen.getByText('Application Received')).toBeInTheDocument();
      expect(screen.getByText('Welcome to the beta!')).toBeInTheDocument();
    });
  });

  it('should show error message on failed submission', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: 'Email already registered' }),
    });

    render(<BetaApplyModal onClose={mockOnClose} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'Australia' } });

    fireEvent.click(screen.getByRole('button', { name: /submit application/i }));

    await waitFor(() => {
      expect(screen.getByText('Email already registered')).toBeInTheDocument();
    });
  });

  it('should show network error on fetch failure', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(<BetaApplyModal onClose={mockOnClose} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'Australia' } });

    fireEvent.click(screen.getByRole('button', { name: /submit application/i }));

    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });

  it('should close modal when close button is clicked', () => {
    render(<BetaApplyModal onClose={mockOnClose} />);

    const closeButton = screen.getAllByRole('button')[0]; // X button
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should close modal when escape key is pressed', () => {
    render(<BetaApplyModal onClose={mockOnClose} />);

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should validate email format', () => {
    render(<BetaApplyModal onClose={mockOnClose} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'invalid-email' } });
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'Australia' } });

    const submitButton = screen.getByRole('button', { name: /submit application/i });
    expect(submitButton).toBeDisabled();
  });

  it('should prevent body scroll when modal is open', () => {
    render(<BetaApplyModal onClose={mockOnClose} />);

    expect(document.body.style.overflow).toBe('hidden');
  });

  it('should restore body scroll when modal is closed', () => {
    const { unmount } = render(<BetaApplyModal onClose={mockOnClose} />);

    unmount();

    expect(document.body.style.overflow).toBe('');
  });
});
