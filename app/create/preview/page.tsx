'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Zap, ArrowLeft, MessageSquare } from 'lucide-react';
import { getRoute, RouteDetailResponse } from '../../lib/api';
import { PhoneSimulator } from '../../components/simulator/PhoneSimulator';
import { trackSimulatorViewed } from '../../lib/analytics';

/**
 * Generate static sample SMS content for a waypoint preview.
 * Uses labeled spaced format from backend/app/services/formatter.py.
 */
function generateSampleSMS(smsCode: string, name: string, elevation?: number): string {
  const elev = elevation || 1200;
  return `CAST ${smsCode}
${name} (${elev}m)
Light 06:00-20:51

06h 5-7o Rn15% W12-20 Cld40% CB18 FL22

08h 7-10o Rn18% W14-22 Cld45% CB17 FL21

10h 10-14o Rn22% W16-26 Cld52% CB15 FL19

12h 12-16o Rn28% W18-30 Cld58% CB14 FL18

Rn=Rain W=Wind Cld=Cloud
CB=CloudBase(x100m) FL=Freeze(x100m)`;
}

function PreviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeId = searchParams.get('id');

  const [route, setRoute] = useState<RouteDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

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
        // Track simulator_viewed analytics event
        trackSimulatorViewed(parseInt(routeId!));
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
          <Link href="/create" className="text-orange-500 hover:underline">
            Back to route creation
          </Link>
        </div>
      </div>
    );
  }

  // Get the first waypoint for preview
  const firstWaypoint = route.waypoints[0];
  const smsContent = firstWaypoint
    ? generateSampleSMS(firstWaypoint.sms_code, firstWaypoint.name, firstWaypoint.elevation)
    : 'No waypoints yet';

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

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href={`/create?id=${routeId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Edit Route
        </Link>

        {/* Main heading */}
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{route.name}</h1>
        <p className="text-gray-600 mb-8">
          This is what you&apos;ll receive for <span className="font-medium">{firstWaypoint?.name || 'your waypoints'}</span>
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Phone Simulator */}
          <div className="flex justify-center">
            <PhoneSimulator
              content={smsContent}
              variant="iphone"
              animateTyping={true}
            />
          </div>

          {/* Route summary and CTA */}
          <div className="space-y-6">
            {/* SMS Codes list */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-5 h-5 text-orange-500" />
                <h2 className="font-semibold text-gray-900">Your SMS Codes</h2>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                {route.waypoints.length} waypoint{route.waypoints.length !== 1 ? 's' : ''} on this route
              </p>

              <div className="space-y-2">
                {route.waypoints.map((wp) => (
                  <div
                    key={wp.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <span className="text-gray-900">{wp.name}</span>
                    <code className="px-2 py-1 bg-orange-100 text-orange-700 rounded font-mono text-sm">
                      {wp.sms_code}
                    </code>
                  </div>
                ))}
              </div>
            </div>

            {/* Activate CTA */}
            <button
              onClick={() => setShowPaywall(true)}
              className="w-full py-4 bg-orange-500 text-white rounded-lg font-semibold text-lg hover:bg-orange-600 transition-colors"
            >
              Activate Route - $29.99
            </button>

            <p className="text-center text-sm text-gray-500">
              One-time purchase. Includes $10 SMS credits (~140 forecasts).
            </p>
          </div>
        </div>
      </div>

      {/* PaywallModal will be added in Task 2 */}
      {showPaywall && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md mx-4">
            <p className="text-gray-600">PaywallModal coming in Task 2...</p>
            <button
              onClick={() => setShowPaywall(false)}
              className="mt-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PreviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    }>
      <PreviewContent />
    </Suspense>
  );
}
