'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Zap, Check, MapPin, MessageSquare, CreditCard, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { getTrackingContext, trackPurchaseCompleted, trackPageView } from '@/app/lib/analytics';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type SessionStatus = 'loading' | 'success' | 'pending' | 'failed' | 'not_found' | 'already_used';

interface SessionData {
  id: string;
  status: string;
  payment_status: string;
  amount_total: number;
  metadata: {
    account_id?: string;
    order_id?: string;
    entry_path?: string;
    customer_name?: string;
    route_id?: string;
  };
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessionId = searchParams.get('session_id');
  const trackingContext = getTrackingContext();

  useEffect(() => {
    trackPageView('/checkout/success');

    if (!sessionId) {
      setStatus('not_found');
      setError('No session ID provided');
      return;
    }

    // Verify the session with backend
    const verifySession = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/payments/session/${sessionId}`);
        const data = await response.json();

        if (!response.ok) {
          if (response.status === 404) {
            setStatus('not_found');
            setError('Session not found. Please contact support if you completed payment.');
          } else {
            setStatus('failed');
            setError(data.detail || 'Failed to verify session');
          }
          return;
        }

        const sessionData = data.session as SessionData;
        setSession(sessionData);

        // Determine status based on payment_status
        if (sessionData.payment_status === 'paid') {
          setStatus('success');

          // Track purchase completed
          if (sessionData.amount_total) {
            trackPurchaseCompleted(sessionData.amount_total);
          }

          // Store token if provided in response
          if (data.access_token) {
            localStorage.setItem('tb_token', data.access_token);
          }
        } else if (sessionData.payment_status === 'unpaid') {
          // Check if session is expired/cancelled
          if (sessionData.status === 'expired') {
            setStatus('failed');
            setError('This checkout session has expired. Please try again.');
          } else {
            setStatus('pending');
          }
        } else {
          setStatus('pending');
        }
      } catch (err) {
        setStatus('failed');
        setError('Unable to verify payment. Please check your email for confirmation.');
      }
    };

    verifySession();
  }, [sessionId]);

  // Check if user came from "create-first" path
  const isCreateFirstPath = session?.metadata?.entry_path === 'create' || trackingContext?.entry_path === 'create';
  const hasRouteId = session?.metadata?.route_id;

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-gray-600">Verifying your payment...</p>
        </div>
      </div>
    );
  }

  if (status === 'not_found' || status === 'failed') {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-md mx-auto px-4">
          <div className="card p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h1>
            <p className="text-gray-600 mb-6">{error}</p>

            <div className="space-y-4">
              <button
                onClick={() => window.location.reload()}
                className="w-full btn-secondary flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>

              <Link href="/checkout" className="block w-full btn-orange text-center">
                Return to Checkout
              </Link>

              <p className="text-sm text-gray-500">
                Need help? Contact <a href="mailto:support@thunderbird.app" className="text-orange-500 hover:underline">support@thunderbird.app</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-md mx-auto px-4">
          <div className="card p-8 text-center">
            <Loader2 className="w-16 h-16 text-orange-500 mx-auto mb-4 animate-spin" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Processing</h1>
            <p className="text-gray-600 mb-6">
              Your payment is being processed. You&apos;ll receive an email confirmation shortly.
            </p>

            <div className="bg-orange-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-orange-800">
                This page will update automatically when your payment is confirmed.
              </p>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="btn-secondary flex items-center justify-center gap-2 mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Check Status
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <Zap className="w-8 h-8 text-orange-500" />
            <span className="font-bold text-xl text-gray-900">Thunderbird</span>
          </Link>
        </div>

        {/* Success Card */}
        <div className="card p-8 text-center mb-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-green-600" />
          </div>

          {isCreateFirstPath && hasRouteId ? (
            <>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Route is Now Active!</h1>
              <p className="text-gray-600 text-lg mb-6">
                Payment confirmed. You can now request weather forecasts for your route via SMS.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Thunderbird!</h1>
              <p className="text-gray-600 text-lg mb-6">
                Your account is ready. Let&apos;s set up your first route.
              </p>
            </>
          )}

          {/* What's included */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
            <h3 className="font-semibold text-gray-900 mb-4">What&apos;s included:</h3>
            <div className="grid gap-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">$10 SMS Credits</p>
                  <p className="text-sm text-gray-500">~140 weather forecasts, credits never expire</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Unlimited Custom Routes</p>
                  <p className="text-sm text-gray-500">Create routes anywhere in our coverage area</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">On-Demand Forecasts</p>
                  <p className="text-sm text-gray-500">Text your waypoint code to get weather via satellite SMS</p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="space-y-4">
            {isCreateFirstPath && hasRouteId ? (
              <>
                <Link href="/routes" className="block w-full btn-orange text-center text-lg py-4">
                  View My Routes
                </Link>
                <Link href="/create" className="block w-full btn-secondary text-center">
                  Create Another Route
                </Link>
              </>
            ) : (
              <>
                <Link href="/create" className="block w-full btn-orange text-center text-lg py-4">
                  Create Your First Route
                </Link>
                <Link href="/library" className="block w-full btn-secondary text-center">
                  Browse Route Library
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Next Steps */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Next Steps</h3>
          <ol className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold text-orange-600">1</span>
              <span className="text-gray-600">Create a custom route with your waypoints (camps, peaks, POIs)</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold text-orange-600">2</span>
              <span className="text-gray-600">Link your phone number to enable SMS forecasts</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold text-orange-600">3</span>
              <span className="text-gray-600">On trail, text your waypoint code to get the latest forecast</span>
            </li>
          </ol>
        </div>

        {/* Email confirmation note */}
        <p className="text-center text-sm text-gray-500 mt-6">
          A confirmation email has been sent to your registered email address.
        </p>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
