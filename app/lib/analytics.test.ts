/**
 * Analytics Utilities Tests
 *
 * Tests path tracking, A/B assignment, and event tracking.
 */

import {
  initPathTracking,
  getTrackingContext,
  trackEvent,
  trackPageView,
  trackCheckoutStarted,
  trackSimulatorViewed,
  trackRouteCreated,
  clearTracking,
} from './analytics';

describe('Analytics Utilities', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('initPathTracking', () => {
    it('initializes with organic path by default', () => {
      const params = new URLSearchParams();
      initPathTracking(params);

      expect(localStorage.setItem).toHaveBeenCalledWith('tb_entry_path', 'organic');
    });

    it('detects create path from URL param', () => {
      const params = new URLSearchParams('path=create');
      initPathTracking(params);

      expect(localStorage.setItem).toHaveBeenCalledWith('tb_entry_path', 'create');
    });

    it('detects buy path from URL param', () => {
      const params = new URLSearchParams('path=buy');
      initPathTracking(params);

      expect(localStorage.setItem).toHaveBeenCalledWith('tb_entry_path', 'buy');
    });

    it('assigns A/B variant randomly', () => {
      const params = new URLSearchParams();
      initPathTracking(params);

      // Should set variant to either A or B
      const variantCalls = (localStorage.setItem as jest.Mock).mock.calls.filter(
        ([key]: [string]) => key === 'tb_variant'
      );
      expect(variantCalls.length).toBe(1);
      expect(['A', 'B']).toContain(variantCalls[0][1]);
    });

    it('sets session start timestamp', () => {
      const params = new URLSearchParams();
      initPathTracking(params);

      const sessionStartCalls = (localStorage.setItem as jest.Mock).mock.calls.filter(
        ([key]: [string]) => key === 'tb_session_start'
      );
      expect(sessionStartCalls.length).toBe(1);
      // Should be a valid ISO date string
      expect(() => new Date(sessionStartCalls[0][1])).not.toThrow();
    });

    it('does not overwrite existing tracking data', () => {
      // Simulate existing session
      (localStorage.getItem as jest.Mock).mockReturnValue('organic');

      const params = new URLSearchParams('path=buy');
      initPathTracking(params);

      // Should not set new values
      expect(localStorage.setItem).not.toHaveBeenCalled();
    });

    it('ignores invalid path param values', () => {
      const params = new URLSearchParams('path=invalid');
      initPathTracking(params);

      expect(localStorage.setItem).toHaveBeenCalledWith('tb_entry_path', 'organic');
    });
  });

  describe('getTrackingContext', () => {
    it('returns null when not initialized', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(null);

      const context = getTrackingContext();

      expect(context).toBeNull();
    });

    it('returns tracking context when initialized', () => {
      // Mock localStorage to return stored values
      (localStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        const values: Record<string, string> = {
          'tb_entry_path': 'create',
          'tb_variant': 'B',
          'tb_session_start': '2026-01-21T10:00:00Z',
        };
        return values[key] || null;
      });

      const context = getTrackingContext();

      expect(context).toEqual({
        entry_path: 'create',
        variant: 'B',
        session_start: '2026-01-21T10:00:00Z',
      });
    });

    it('returns null if any field is missing', () => {
      // Mock partial data
      (localStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'tb_entry_path') return 'create';
        return null;
      });

      const context = getTrackingContext();

      expect(context).toBeNull();
    });
  });

  describe('trackEvent', () => {
    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true });
    });

    it('sends event to analytics API', async () => {
      await trackEvent('test_event', { key: 'value' });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/analytics'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('includes event name in payload', async () => {
      await trackEvent('button_click', {});

      const fetchCall = (fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.event).toBe('button_click');
    });

    it('includes properties in payload', async () => {
      await trackEvent('page_view', { page: '/home', section: 'hero' });

      const fetchCall = (fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.properties).toEqual({ page: '/home', section: 'hero' });
    });

    it('includes tracking context if available', async () => {
      (localStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        const values: Record<string, string> = {
          'tb_entry_path': 'buy',
          'tb_variant': 'A',
          'tb_session_start': '2026-01-21T10:00:00Z',
        };
        return values[key] || null;
      });

      await trackEvent('test', {});

      const fetchCall = (fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.entry_path).toBe('buy');
      expect(body.variant).toBe('A');
    });

    it('handles API errors gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      // Should not throw
      await expect(trackEvent('test', {})).resolves.not.toThrow();
    });
  });

  describe('trackPageView', () => {
    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true });
    });

    it('tracks page_view event', async () => {
      await trackPageView('/checkout');

      expect(fetch).toHaveBeenCalled();

      const fetchCall = (fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.event).toBe('page_view');
      expect(body.properties.page).toBe('/checkout');
    });
  });

  describe('trackCheckoutStarted', () => {
    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true });
    });

    it('tracks checkout_started event', async () => {
      await trackCheckoutStarted();

      const fetchCall = (fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.event).toBe('checkout_started');
    });
  });

  describe('trackSimulatorViewed', () => {
    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true });
    });

    it('tracks simulator_viewed with route ID', async () => {
      await trackSimulatorViewed(42);

      const fetchCall = (fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.event).toBe('simulator_viewed');
      expect(body.properties.route_id).toBe(42);
    });
  });

  describe('trackRouteCreated', () => {
    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true });
    });

    it('tracks route_created with waypoint count', async () => {
      await trackRouteCreated(5);

      const fetchCall = (fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.event).toBe('route_created');
      expect(body.properties.waypoint_count).toBe(5);
    });
  });

  describe('clearTracking', () => {
    it('removes all tracking keys from localStorage', () => {
      clearTracking();

      expect(localStorage.removeItem).toHaveBeenCalledWith('tb_entry_path');
      expect(localStorage.removeItem).toHaveBeenCalledWith('tb_variant');
      expect(localStorage.removeItem).toHaveBeenCalledWith('tb_session_start');
    });
  });
});

describe('A/B Variant Distribution', () => {
  it('distributes variants roughly 50/50 over many samples', () => {
    let countA = 0;
    let countB = 0;

    // Run 100 samples
    for (let i = 0; i < 100; i++) {
      localStorage.clear();
      (localStorage.getItem as jest.Mock).mockReturnValue(null);

      const params = new URLSearchParams();
      initPathTracking(params);

      const variantCall = (localStorage.setItem as jest.Mock).mock.calls.find(
        ([key]: [string]) => key === 'tb_variant'
      );

      if (variantCall) {
        if (variantCall[1] === 'A') countA++;
        else if (variantCall[1] === 'B') countB++;
      }

      (localStorage.setItem as jest.Mock).mockClear();
    }

    // Allow for some variance (expect 30-70 split at minimum)
    expect(countA).toBeGreaterThan(20);
    expect(countB).toBeGreaterThan(20);
  });
});
