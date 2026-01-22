'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Lock, Mail, User, CreditCard, Eye, EyeOff, Check, Shield } from 'lucide-react';
import { trackCheckoutStarted, getTrackingContext } from '../../lib/analytics';

interface PaywallModalProps {
  /** Route ID to activate after purchase */
  routeId: number;
  /** Route name to display */
  routeName: string;
  /** Number of waypoints on route */
  waypointCount: number;
  /** Called after successful purchase */
  onSuccess: () => void;
  /** Called when modal is closed without purchase */
  onClose: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * PaywallModal - Purchase flow modal for route activation.
 *
 * Shows order summary, account creation form (if not logged in),
 * and payment form. Submits to /api/payments/checkout endpoint.
 */
export function PaywallModal({
  routeId,
  routeName,
  waypointCount,
  onSuccess,
  onClose,
}: PaywallModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user is logged in
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const isLoggedIn = !!token;

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    cardNumber: '',
    expiry: '',
    cvc: '',
  });

  // Track checkout_started event when modal opens
  useEffect(() => {
    trackCheckoutStarted();
  }, []);

  // Handle escape key and click outside
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);

    // Prevent body scroll while modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  const handleInputChange = (field: string, value: string) => {
    // Format card number with spaces
    if (field === 'cardNumber') {
      value = value.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim();
      if (value.length > 19) return;
    }
    // Format expiry as MM/YY
    if (field === 'expiry') {
      value = value.replace(/\D/g, '');
      if (value.length >= 2) {
        value = value.slice(0, 2) + '/' + value.slice(2, 4);
      }
      if (value.length > 5) return;
    }
    // Limit CVC to 3-4 digits
    if (field === 'cvc') {
      value = value.replace(/\D/g, '');
      if (value.length > 4) return;
    }

    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const isFormValid = isLoggedIn
    ? (
        formData.cardNumber.replace(/\s/g, '').length === 16 &&
        formData.expiry.length === 5 &&
        formData.cvc.length >= 3
      )
    : (
        formData.email.includes('@') &&
        formData.password.length >= 8 &&
        formData.name.length > 0 &&
        formData.cardNumber.replace(/\s/g, '').length === 16 &&
        formData.expiry.length === 5 &&
        formData.cvc.length >= 3
      );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Get tracking context for entry_path
      const trackingContext = getTrackingContext();

      // Build request body
      const body: Record<string, unknown> = {
        route_id: routeId,
        entry_path: trackingContext?.entry_path || 'organic',
      };

      if (!isLoggedIn) {
        body.email = formData.email;
        body.password = formData.password;
        body.name = formData.name;
      }

      // For MVP, we simulate a successful checkout since we're not doing
      // real Stripe integration in the modal (plan specifies we hit /api/payments/checkout)
      // In production, this would redirect to Stripe Checkout or use Stripe Elements

      // Call checkout endpoint
      const response = await fetch(`${API_BASE}/api/payments/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Payment failed' }));
        throw new Error(errorData.detail || 'Payment failed');
      }

      const result = await response.json();

      // If we got a checkout_url, we would redirect to Stripe
      // For now, since we have test mode, simulate success
      if (result.checkout_url) {
        // In production: window.location.href = result.checkout_url;
        // For demo/test: simulate success
        await new Promise(resolve => setTimeout(resolve, 1500));
        onSuccess();
      } else {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        ref={modalRef}
        className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Activate Your Route</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          {/* Order Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Thunderbird Starter Pack</span>
              <span className="font-medium">USD $29.99</span>
            </div>
            <div className="text-sm text-gray-500 mb-3">
              Includes USD $10 SMS credits (~140 forecasts)
            </div>
            <div className="text-sm text-gray-600 mb-3 pb-3 border-b border-gray-200">
              Route: <span className="font-medium">{routeName}</span> ({waypointCount} waypoint{waypointCount !== 1 ? 's' : ''})
            </div>
            <div className="border-t border-gray-200 pt-3 flex justify-between">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-lg">USD $29.99</span>
            </div>
          </div>

          {/* What's included */}
          <div className="bg-orange-50 rounded-lg p-4">
            <h3 className="font-medium text-orange-800 mb-2">What&apos;s included:</h3>
            <ul className="space-y-1 text-sm text-orange-700">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-orange-500" />
                Unlimited custom routes
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-orange-500" />
                USD $10 SMS credit balance
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-orange-500" />
                Credits never expire
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-orange-500" />
                No monthly subscription
              </li>
            </ul>
          </div>

          {/* Account Creation (if not logged in) */}
          {!isLoggedIn && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <User className="w-5 h-5 text-gray-400" />
                Create Account
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="John Smith"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Minimum 8 characters"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
              </div>
            </div>
          )}

          {/* Payment Details */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-gray-400" />
              Payment Details
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Card Number
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.cardNumber}
                  onChange={(e) => handleInputChange('cardNumber', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono"
                  placeholder="4242 4242 4242 4242"
                  required
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                  <div className="w-8 h-5 bg-gradient-to-r from-blue-600 to-blue-800 rounded text-white text-[8px] flex items-center justify-center font-bold">VISA</div>
                  <div className="w-8 h-5 bg-gradient-to-r from-red-500 to-yellow-500 rounded text-white text-[8px] flex items-center justify-center font-bold">MC</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiry Date
                </label>
                <input
                  type="text"
                  value={formData.expiry}
                  onChange={(e) => handleInputChange('expiry', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono"
                  placeholder="MM/YY"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CVC
                </label>
                <input
                  type="text"
                  value={formData.cvc}
                  onChange={(e) => handleInputChange('cvc', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono"
                  placeholder="123"
                  required
                />
              </div>
            </div>

            {/* Test card hint */}
            <div className="p-3 bg-gray-100 rounded-lg text-sm text-gray-600">
              <p className="font-medium">Test Mode</p>
              <p>Use card number <code className="bg-gray-200 px-1 rounded">4242 4242 4242 4242</code> with any future expiry and CVC.</p>
            </div>
          </div>

          {/* Error display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isFormValid || isProcessing}
            className={`w-full py-4 rounded-lg font-semibold text-lg transition-all flex items-center justify-center gap-2 ${
              isFormValid && !isProcessing
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isProcessing ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Lock className="w-5 h-5" />
                Pay USD $29.99
              </>
            )}
          </button>

          {/* Security note */}
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <Shield className="w-4 h-4" />
            <span>Secure checkout powered by Stripe</span>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PaywallModal;
