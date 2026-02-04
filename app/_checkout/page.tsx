'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Zap, Lock, Mail, User, Eye, EyeOff, Check, Shield, Loader2, AlertCircle, LogOut } from 'lucide-react';
import { initPathTracking, getTrackingContext, trackCheckoutStarted, trackPageView } from '@/app/lib/analytics';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

function CheckoutForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loggedInEmail, setLoggedInEmail] = useState<string | null>(null);
  const [saveCard, setSaveCard] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  });

  // Initialize tracking on mount
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    initPathTracking(params);
    trackPageView('/checkout');

    // Check if user is logged in
    const token = localStorage.getItem('tb_token');
    if (token) {
      // Verify token and get user email
      fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            setIsLoggedIn(true);
            setLoggedInEmail(data.email);
          }
        })
        .catch(() => {
          // Token invalid, clear it
          localStorage.removeItem('tb_token');
        });
    }
  }, [searchParams]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null); // Clear error when user types
  };

  const handleLogout = () => {
    localStorage.removeItem('tb_token');
    setIsLoggedIn(false);
    setLoggedInEmail(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setError(null);

    // Track checkout started
    trackCheckoutStarted();

    const trackingContext = getTrackingContext();

    try {
      if (isLoggedIn) {
        // Logged in user - use existing checkout endpoint
        const token = localStorage.getItem('tb_token');
        const response = await fetch(`${API_BASE}/api/payments/checkout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            success_url: `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${window.location.origin}/checkout`,
            save_card: saveCard
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || 'Failed to create checkout session');
        }

        // Redirect to Stripe
        if (data.checkout_url) {
          window.location.href = data.checkout_url;
        }
      } else {
        // New user - use buy-now endpoint (creates account + checkout)
        const response = await fetch(`${API_BASE}/api/payments/buy-now`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            name: formData.name,
            entry_path: trackingContext?.entry_path || 'organic',
            save_card: saveCard
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || 'Failed to create account');
        }

        // Store the token for later (after Stripe redirect)
        if (data.access_token) {
          localStorage.setItem('tb_token', data.access_token);
        }

        // Redirect to Stripe Checkout
        if (data.checkout_url) {
          window.location.href = data.checkout_url;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsProcessing(false);
    }
  };

  const isFormValid = isLoggedIn || (
    formData.email.includes('@') &&
    formData.email.includes('.') &&
    formData.password.length >= 8 &&
    formData.name.trim().length > 0
  );

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <Zap className="w-8 h-8 text-orange-500" />
            <span className="font-bold text-xl text-gray-900">Thunderbird</span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Complete Your Purchase</h1>
          <p className="text-gray-600 mt-2">Create your account and start building custom weather routes</p>
        </div>

        <div className="grid md:grid-cols-5 gap-8">
          {/* Order Summary - Right side on desktop */}
          <div className="md:col-span-2 md:order-2">
            <div className="card p-6 sticky top-24">
              <h2 className="font-semibold text-lg mb-4">Order Summary</h2>

              <div className="space-y-4 mb-6">
                <div className="bg-orange-100 border border-orange-200 rounded-lg p-3 text-center mb-4">
                  <span className="text-orange-800 font-medium">Launch Offer: </span>
                  <span className="text-orange-600 line-through">USD $49.99</span>
                  <span className="text-orange-800 font-bold ml-2">USD $29.99</span>
                  <span className="text-orange-600 text-sm ml-2">— ends Feb 28th 2026</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Thunderbird Starter Pack</span>
                  <span className="font-medium">USD $29.99</span>
                </div>
                <div className="text-sm text-gray-500 -mt-2">
                  Includes $10 USD SMS credits — up to 30 days on trail
                </div>
                <div className="border-t border-gray-200 pt-4 flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-xl">USD $29.99</span>
                </div>
              </div>

              <div className="bg-orange-50 rounded-lg p-4 mb-4">
                <h3 className="font-medium text-orange-800 mb-2">What&apos;s included:</h3>
                <ul className="space-y-2 text-sm text-orange-700">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-orange-500" />
                    Unlimited custom routes
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-orange-500" />
                    $10 USD SMS credits
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-orange-500 mt-0.5" />
                    <div>
                      Up to 30 days on trail (30 US / 7 AU)
                      <div className="text-xs text-orange-500/70">SMS network access costs differ</div>
                    </div>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-orange-500" />
                    No monthly subscription
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-orange-500" />
                    Pay-as-you-go top ups
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-orange-500" />
                    Credits never expire
                  </li>
                </ul>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Shield className="w-4 h-4" />
                <span>Secure checkout powered by Stripe</span>
              </div>
            </div>
          </div>

          {/* Checkout Form - Left side on desktop */}
          <div className="md:col-span-3 md:order-1">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-800 font-medium">Error</p>
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                </div>
              )}

              {/* Account Section */}
              <div className="card p-6">
                {isLoggedIn ? (
                  <>
                    <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <User className="w-5 h-5 text-gray-400" />
                      Account
                    </h2>
                    <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <Check className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Logged in as</p>
                          <p className="text-gray-600 text-sm">{loggedInEmail}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                      >
                        <LogOut className="w-4 h-4" />
                        Log out
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <User className="w-5 h-5 text-gray-400" />
                      Create Account
                    </h2>

                    <div className="space-y-4">
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

                    <div className="mt-4 text-sm text-gray-500">
                      Already have an account?{' '}
                      <Link href="/login" className="text-orange-500 hover:underline">Log in</Link>
                    </div>
                  </>
                )}
              </div>

              {/* Payment Info */}
              <div className="card p-6">
                <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-gray-400" />
                  Payment
                </h2>

                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-gray-600 mb-2">
                    You&apos;ll be redirected to Stripe&apos;s secure checkout to complete payment.
                  </p>
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                    <Shield className="w-4 h-4" />
                    <span>Your payment info is handled securely by Stripe</span>
                  </div>
                </div>

                {/* Save Card Opt-in */}
                <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveCard}
                      onChange={(e) => setSaveCard(e.target.checked)}
                      className="mt-1 w-5 h-5 rounded border-orange-300 text-orange-500 focus:ring-orange-500"
                    />
                    <div>
                      <span className="font-medium text-orange-800">Save card for SMS top-ups on trail</span>
                      <p className="text-sm text-orange-700 mt-1">
                        Top up credits via satellite SMS while hiking — no internet required.
                        Reply YES$10, YES$25, or YES$50 when your balance is low.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Payment method logos */}
                <div className="mt-4 flex items-center justify-center gap-3">
                  <div className="w-10 h-6 bg-gradient-to-r from-blue-600 to-blue-800 rounded text-white text-[8px] flex items-center justify-center font-bold">VISA</div>
                  <div className="w-10 h-6 bg-gradient-to-r from-red-500 to-yellow-500 rounded text-white text-[8px] flex items-center justify-center font-bold">MC</div>
                  <div className="w-10 h-6 bg-blue-500 rounded text-white text-[8px] flex items-center justify-center font-bold">AMEX</div>
                  <div className="px-2 h-6 bg-black rounded text-white text-[8px] flex items-center justify-center font-bold">Apple Pay</div>
                </div>
              </div>

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
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Redirecting to Stripe...
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    Continue to Payment
                  </>
                )}
              </button>

              <p className="text-center text-sm text-gray-500">
                By completing this purchase, you agree to our{' '}
                <Link href="/terms" className="text-orange-500 hover:underline">Terms of Service</Link>
                {' '}and{' '}
                <Link href="/privacy" className="text-orange-500 hover:underline">Privacy Policy</Link>.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    }>
      <CheckoutForm />
    </Suspense>
  );
}
