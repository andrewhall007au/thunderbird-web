'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Zap, ArrowLeft, MessageSquare } from 'lucide-react';
import { getRoute, updateRoute, getForecastPreview, RouteDetailResponse } from '../../lib/api';
import { PhoneSimulator } from '../../components/simulator/PhoneSimulator';
import { trackSimulatorViewed } from '../../lib/analytics';

/**
 * Generate full SMS content based on command type - exactly as user would receive.
 */
function generateSampleSMS(
  command: string,
  smsCode: string,
  name: string,
  elevation?: number,
  allWaypoints?: Array<{ name: string; sms_code: string; type: string; lat: number; lng: number }>,
  firstWaypointLat?: number,
  firstWaypointLng?: number
): string {
  const elev = elevation || 1200;
  const lat = firstWaypointLat?.toFixed(4) || '-41.8921';
  const lng = firstWaypointLng?.toFixed(4) || '146.0820';

  switch (command) {
    case 'CAST12':
      return `CAST12 ${smsCode} ${elev}m
${lat}, ${lng}
Light 06:00-20:51
12 hour detailed forecast

06h 5-7° Rn15% 0-1mm W12-20 Cld40% CB12 FL28

07h 6-8° Rn15% 0-1mm W13-21 Cld42% CB12 FL27

08h 7-10° Rn18% 0-2mm W14-22 Cld45% CB12 FL26

09h 9-12° Rn20% 0-2mm W15-24 Cld48% CB11 FL25

10h 10-14° Rn22% 0-3mm W16-26 Cld52% CB11 FL24

11h 11-15° Rn24% 0-3mm W17-28 Cld56% CB10 FL23

12h 12-16° Rn25% 1-4mm W18-30 Cld60% CB10 FL22

13h 13-17° Rn28% 1-5mm W19-32 Cld62% CB10 FL21

14h 14-18° Rn30% 2-6mm W20-35 Cld65% CB9 FL20

15h 13-17° Rn28% 1-5mm W18-32 Cld60% CB10 FL21

16h 12-16° Rn25% 1-4mm W16-28 Cld55% CB11 FL22

17h 10-14° Rn22% 0-3mm W14-25 Cld50% CB12 FL23

Rn=Rain W=Wind Cld=Cloud
CB=CloudBase FL=Freeze(x100m)`;

    case 'CAST24':
      return `CAST24 ${smsCode} ${elev}m
${lat}, ${lng}
Light 06:00-20:51
24 hour detailed forecast

06h 5-7° Rn15% 0-1mm W12-20 Cld40% CB12 FL28

07h 6-8° Rn15% 0-1mm W13-21 Cld42% CB12 FL27

08h 7-10° Rn18% 0-2mm W14-22 Cld45% CB12 FL26

09h 9-12° Rn20% 0-2mm W15-24 Cld48% CB11 FL25

10h 10-14° Rn22% 0-3mm W16-26 Cld52% CB11 FL24

11h 11-15° Rn24% 0-3mm W17-28 Cld56% CB10 FL23

12h 12-16° Rn25% 1-4mm W18-30 Cld60% CB10 FL22

13h 13-17° Rn28% 1-5mm W19-32 Cld62% CB10 FL21

14h 14-18° Rn30% 2-6mm W20-35 Cld65% CB9 FL20

15h 13-17° Rn28% 1-5mm W18-32 Cld60% CB10 FL21

16h 12-16° Rn25% 1-4mm W16-28 Cld55% CB11 FL22

17h 10-14° Rn22% 0-3mm W14-25 Cld50% CB12 FL23

18h 9-12° Rn20% 0-2mm W13-22 Cld45% CB12 FL24

19h 8-11° Rn18% 0-2mm W12-20 Cld42% CB13 FL25

20h 7-10° Rn16% 0-1mm W11-18 Cld40% CB13 FL26

21h 6-9° Rn15% 0-1mm W10-17 Cld38% CB14 FL27

22h 5-8° Rn14% 0-1mm W9-16 Cld36% CB14 FL28

23h 4-7° Rn12% 0-1mm W8-15 Cld34% CB15 FL29

00h 4-6° Rn10% 0-1mm W8-14 Cld32% CB15 FL29

01h 3-6° Rn10% 0-1mm W7-13 Cld30% CB16 FL30

02h 3-5° Rn8% 0-1mm W7-12 Cld28% CB16 FL30

03h 3-5° Rn8% 0-1mm W6-12 Cld28% CB16 FL30

04h 3-6° Rn10% 0-1mm W7-13 Cld30% CB16 FL30

05h 4-7° Rn12% 0-1mm W8-15 Cld32% CB15 FL29

Rn=Rain W=Wind Cld=Cloud
CB=CloudBase FL=Freeze(x100m)`;

    case 'CAMPS7':
      const camps = allWaypoints?.filter(w => w.type === 'camp') || [];
      const campForecasts = camps.length > 0
        ? camps.map(c => `${c.sms_code}: ${c.name}
${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}

Mon 4-12° Rn15% 0-2mm W10-25 Cld40% CB15 FL25
Tue 6-14° Rn25% 2-6mm W12-28 Cld55% CB12 FL22
Wed 3-9° Rn65% 8-15mm W20-45 Cld85% CB8 FL18
Thu 2-8° Rn45% 5-12mm W18-38 Cld70% CB10 FL20
Fri 5-13° Rn20% 1-4mm W8-22 Cld45% CB14 FL24
Sat 7-16° Rn10% 0-2mm W6-18 Cld30% CB18 FL28
Sun 8-17° Rn5% 0-1mm W5-15 Cld20% CB20 FL30`).join('\n\n─────────────────\n\n')
        : 'No camps defined';
      return `CAMPS7
7-Day Forecast for All Camps

${campForecasts}

Rn=Rain W=Wind Cld=Cloud
CB=CloudBase FL=Freeze(x100m)`;

    case 'PEAKS7':
      const peaks = allWaypoints?.filter(w => w.type === 'peak') || [];
      const peakForecasts = peaks.length > 0
        ? peaks.map(p => `${p.sms_code}: ${p.name}
${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}

Mon 2-8° Rn20% 1-4mm W15-30 Cld45% CB12 FL22
Tue 4-10° Rn30% 3-8mm W18-35 Cld60% CB10 FL20
Wed 0-5° Rn70% 10-20mm W25-50 Cld90% CB6 FL15
Thu -1-4° Rn50% 6-14mm W22-42 Cld75% CB8 FL17
Fri 3-10° Rn25% 2-5mm W12-28 Cld50% CB12 FL22
Sat 5-12° Rn15% 1-3mm W10-22 Cld35% CB16 FL26
Sun 6-14° Rn10% 0-2mm W8-20 Cld25% CB18 FL28`).join('\n\n─────────────────\n\n')
        : 'No peaks defined';
      return `PEAKS7
7-Day Forecast for All Peaks

${peakForecasts}

Rn=Rain W=Wind Cld=Cloud
CB=CloudBase FL=Freeze(x100m)`;

    default:
      return `CAST12 ${smsCode} ${elev}m
${lat}, ${lng}
Light 06:00-20:51

06h 5-7° Rn15% W12-20 Cld40% CB18 FL22

08h 7-10° Rn18% W14-22 Cld45% CB17 FL21

Rn=Rain W=Wind Cld=Cloud`;
  }
}

function PreviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeId = searchParams.get('id');

  const [route, setRoute] = useState<RouteDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [selectedCommand, setSelectedCommand] = useState('CAST12');
  const [selectedWaypointId, setSelectedWaypointId] = useState<number | null>(null);
  const [liveContent, setLiveContent] = useState<string | null>(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [forecastSource, setForecastSource] = useState<'live' | 'sample'>('sample');

  const commands = [
    { code: 'CAST12', label: '12hr Forecast', description: 'Detailed 12-hour hourly forecast for selected waypoint' },
    { code: 'CAST24', label: '24hr Forecast', description: 'Full 24-hour hourly forecast for selected waypoint' },
    { code: 'CAMPS7', label: '7-Day Camps', description: '7-day forecast for all camp waypoints' },
    { code: 'PEAKS7', label: '7-Day Peaks', description: '7-day forecast for all peak waypoints' },
  ];

  const handleActivate = async () => {
    if (!routeId) return;
    setActivating(true);
    try {
      await updateRoute(parseInt(routeId), { status: 'active' });
      router.push('/account');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to activate route');
      setActivating(false);
    }
  };

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

  // Fetch live forecast when command or waypoint changes
  useEffect(() => {
    if (!route) return;

    const waypoint = selectedWaypointId
      ? route.waypoints.find(wp => wp.id === selectedWaypointId)
      : route.waypoints[0];

    if (!waypoint) return;

    async function fetchLiveForecast() {
      setLoadingForecast(true);
      try {
        // For CAMPS7/PEAKS7, pass all waypoints for multi-waypoint forecast
        const allWaypoints = (selectedCommand === 'CAMPS7' || selectedCommand === 'PEAKS7')
          ? route!.waypoints.map(wp => ({
              lat: wp.lat,
              lng: wp.lng,
              elevation: wp.elevation || 1000,
              name: wp.name,
              sms_code: wp.sms_code,
              type: wp.type
            }))
          : undefined;

        const result = await getForecastPreview({
          lat: waypoint!.lat,
          lng: waypoint!.lng,
          elevation: waypoint!.elevation || 1000,
          name: waypoint!.name,
          sms_code: waypoint!.sms_code,
          command: selectedCommand,
          waypoints: allWaypoints
        });
        setLiveContent(result.sms_content);
        setForecastSource(result.source);
      } catch {
        // Fall back to sample data
        setLiveContent(null);
        setForecastSource('sample');
      } finally {
        setLoadingForecast(false);
      }
    }

    fetchLiveForecast();
  }, [route, selectedWaypointId, selectedCommand]);

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

  // Get selected waypoint for preview (default to first)
  const selectedWaypoint = selectedWaypointId
    ? route.waypoints.find(wp => wp.id === selectedWaypointId) || route.waypoints[0]
    : route.waypoints[0];
  const waypointsForCommands = route.waypoints.map(wp => ({
    name: wp.name,
    sms_code: wp.sms_code,
    type: wp.type,
    lat: wp.lat,
    lng: wp.lng
  }));

  // Use live content for CAST12/CAST24 if available, otherwise fall back to sample
  const smsContent = loadingForecast
    ? 'Loading live forecast...'
    : liveContent
      ? liveContent
      : selectedWaypoint
        ? generateSampleSMS(selectedCommand, selectedWaypoint.sms_code, selectedWaypoint.name, selectedWaypoint.elevation, waypointsForCommands, selectedWaypoint.lat, selectedWaypoint.lng)
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
        <p className="text-gray-600 mb-4">
          Preview what you&apos;ll receive when you text commands.{' '}
          <span className={`text-sm ${forecastSource === 'live' ? 'text-green-600' : 'text-gray-500'}`}>
            ({forecastSource === 'live' ? 'Live weather data' : 'Sample data shown'})
          </span>
        </p>

        {/* Waypoint Selector */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Select waypoint:</h2>
          <div className="flex flex-wrap gap-2">
            {route.waypoints.map((wp) => (
              <button
                key={wp.id}
                onClick={() => setSelectedWaypointId(wp.id)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  (selectedWaypointId === wp.id || (!selectedWaypointId && wp.id === route.waypoints[0]?.id))
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                <span className="font-mono text-xs mr-1.5">{wp.sms_code}</span>
                {wp.name}
              </button>
            ))}
          </div>
        </div>

        {/* Command Selector */}
        <div className="mb-8">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Select command:</h2>
          <div className="flex flex-wrap gap-2">
            {commands.map((cmd) => (
              <button
                key={cmd.code}
                onClick={() => setSelectedCommand(cmd.code)}
                className={`px-4 py-2 rounded-lg font-mono text-sm transition-colors ${
                  selectedCommand === cmd.code
                    ? 'bg-orange-500 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:border-orange-300'
                }`}
              >
                {cmd.code}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {commands.find(c => c.code === selectedCommand)?.description}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Phone Simulator */}
          <div className="flex justify-center">
            <PhoneSimulator
              content={smsContent}
              variant="iphone"
              animateTyping={false}
            />
          </div>

          {/* Route summary and CTA */}
          <div className="space-y-6">
            {/* SMS Codes list */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              {(() => {
                const trackCode = route.name
                  .replace(/[^A-Za-z]/g, '')
                  .toUpperCase()
                  .slice(0, 5);
                return (
                  <p className="text-sm text-gray-700 mb-4 bg-orange-50 p-3 rounded-lg border border-orange-200">
                    We will send you your Camps, Peaks and Points of Interest codes once you activate by sending "<strong>START {trackCode}</strong>" to +1 (866) 280-1940
                  </p>
                );
              })()}

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
              onClick={handleActivate}
              disabled={activating}
              className={`w-full py-4 rounded-lg font-semibold text-lg transition-colors ${
                activating
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
            >
              {activating ? 'Activating...' : 'Activate Route'}
            </button>
          </div>
        </div>
      </div>

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
