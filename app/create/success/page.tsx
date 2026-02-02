'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Zap, Check, MessageSquare, ArrowRight } from 'lucide-react';
import { getRoute, RouteDetailResponse } from '../../lib/api';
import { trackPurchaseCompleted } from '../../lib/analytics';

// SMS number for receiving forecasts
const SMS_NUMBER = '+1 (866) 280-1940';

function SuccessContent() {
  const searchParams = useSearchParams();
  const routeId = searchParams.get('id');

  const [route, setRoute] = useState<RouteDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!routeId) {
      setError('No route ID provided');
      setLoading(false);
      return;
    }

    async function loadRoute() {
      try {
        const data = await getRoute(parseInt(routeId!));
        setRoute(data);
        // Track purchase_completed analytics event
        trackPurchaseCompleted(2999); // $29.99
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load route');
      } finally {
        setLoading(false);
      }
    }

    loadRoute();
  }, [routeId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (error || !route) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || 'Route not found'}</p>
          <Link href="/routes" className="text-orange-500 hover:underline">
            View My Routes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link href="/" className="inline-flex items-center gap-2">
            <Zap className="w-6 h-6 text-orange-500" />
            <span className="font-bold text-lg text-gray-900">Thunderbird</span>
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Success checkmark */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Your route is now active!
          </h1>
          <p className="text-gray-600">
            {route.name} is ready to receive SMS weather forecasts
          </p>
        </div>

        {/* SMS Instructions */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-orange-500" />
            <h2 className="font-semibold text-gray-900">How to get your forecast</h2>
          </div>

          <div className="bg-orange-50 rounded-lg p-4 mb-6">
            <p className="text-orange-800">
              <span className="font-medium">Send any waypoint code</span> to our SMS number to receive
              your weather forecast instantly.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-medium">1</span>
              <div>
                <p className="font-medium text-gray-900">Open your SMS app</p>
                <p className="text-sm text-gray-600">From any phone, even without cell service (use satellite messenger)</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-medium">2</span>
              <div>
                <p className="font-medium text-gray-900">Text your waypoint code</p>
                <p className="text-sm text-gray-600">e.g., {route.waypoints[0]?.sms_code || 'LAKEO'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-medium">3</span>
              <div>
                <p className="font-medium text-gray-900">Receive your forecast</p>
                <p className="text-sm text-gray-600">Get temperature, rain chance, wind, cloud cover, and more</p>
              </div>
            </div>
          </div>
        </div>

        {/* Waypoint SMS codes */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 mb-8">
          <h2 className="font-semibold text-gray-900 mb-4">Your SMS Codes</h2>
          <p className="text-sm text-gray-600 mb-4">
            {route.waypoints.length} waypoint{route.waypoints.length !== 1 ? 's' : ''} on {route.name}
          </p>

          <div className="space-y-2">
            {route.waypoints.map((wp) => (
              <div
                key={wp.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <span className="text-gray-900">{wp.name}</span>
                <code className="px-3 py-1 bg-orange-100 text-orange-700 rounded font-mono font-medium">
                  {wp.sms_code}
                </code>
              </div>
            ))}
          </div>

          {/* Copy all codes */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Pro tip:</span> Save these codes in your phone before heading out!
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/routes"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors"
          >
            View My Routes
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/create"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            Create Another Route
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
