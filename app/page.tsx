'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link'
import dynamic from 'next/dynamic';
import { initPathTracking, trackPageView } from '@/app/lib/analytics';
import {
  Zap, Satellite, CloudRain, Shield, Bell, Clock,
  MapPin, Thermometer, Wind, Droplets, Mountain, Smartphone,
  Cloud, Snowflake, AlertTriangle, Navigation, Save, MessageSquare,
  Tent, BatteryCharging, ChevronRight, ExternalLink, Mail, Sun,
  Compass, Database, Info
} from 'lucide-react'
import { BetaButton } from './components/beta/BetaButton'
import SatelliteChecker from './components/SatelliteChecker'

const MapEditor = dynamic(() => import('./components/map/MapEditor'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] bg-zinc-100 rounded-2xl flex items-center justify-center">
      <div className="flex items-center gap-2 text-zinc-400">
        <div className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-500 rounded-full animate-spin" />
        <span className="text-sm">Loading map...</span>
      </div>
    </div>
  )
});

// Demo sequence showing the full user experience
const demoSequence = [
  {
    command: 'CAST12 LAKEO',
    label: '12 Hour Forecast',
    phone: `CAST12 LAKEO 863m
-41.8921, 146.0820
Light 06:00-20:51
12 hour detailed forecast

06h 5-7o Rn15% 0-1mm W12-20 Cld40% CB12 FL28

07h 6-8o Rn15% 0-1mm W13-21 Cld42% CB12 FL27

08h 7-10o Rn18% 0-2mm W14-22 Cld45% CB12 FL26

09h 9-12o Rn20% 0-2mm W15-24 Cld48% CB11 FL25

10h 10-14o Rn22% 0-3mm W16-26 Cld52% CB11 FL24

11h 11-15o Rn24% 0-3mm W17-28 Cld56% CB10 FL23

12h 12-16o Rn25% 1-4mm W18-30 Cld60% CB10 FL22

Rn=Rain W=Wind Cld=Cloud
CB=CloudBase FL=Freeze(x100m)`,
    watch: `CAST12 LAKEO 863m
-41.8921, 146.0820
12hr detailed forecast

06h 5-7o Rn15% 0-1mm
W12-20 CB12 FL28

07h 6-8o Rn15% 0-1mm
W13-21 CB12 FL27

08h 7-10o Rn18% 0-2mm
W14-22 CB12 FL26

09h 9-12o Rn20% 0-2mm
W15-24 CB11 FL25`,
  },
  {
    command: 'CAST7 LAKEO',
    label: '7 Day Forecast',
    phone: `CAST7 LAKEO 863m
-41.8921, 146.0820
7-Day Forecast

Mon 4-12o Rn15% W10-25 Cld35%

Tue 6-14o Rn25% 0-2mm W12-28 Cld55%

Wed 3-9o Rn65% 4-12mm W20-45 Cld85%

Thu 2-8o Rn45% 2-6mm W18-38 Cld70%

Fri 5-13o Rn20% W8-22 Cld40%

Sat 7-16o Rn10% W6-18 Cld25%

Sun 8-17o Rn5% W5-15 Cld20%

Rn=Rain W=Wind Cld=Cloud`,
    watch: `CAST7 LAKEO 863m
-41.8921, 146.0820

Mon 4-12o Rn15% W10-25

Tue 6-14o Rn25% W12-28

Wed 3-9o Rn65% W20-45

Thu 2-8o Rn45% W18-38

Fri 5-13o Rn20% W8-22

Sat 7-16o Rn10% W6-18

Sun 8-17o Rn5% W5-15`,
  },
  {
    command: 'CAST12 -41.89, 146.08',
    label: 'GPS Forecast',
    phone: `CAST12 -41.89, 146.08
Elevation: 863m
12 hour detailed forecast

06h 5-7o Rn15% 0-1mm W12-20 Cld40% CB12 FL28

07h 6-8o Rn15% 0-1mm W13-21 Cld42% CB12 FL27

08h 7-10o Rn18% 0-2mm W14-22 Cld45% CB12 FL26

09h 9-12o Rn20% 0-2mm W15-24 Cld48% CB11 FL25

10h 10-14o Rn22% 0-3mm W16-26 Cld52% CB11 FL24

11h 11-15o Rn24% 0-3mm W17-28 Cld56% CB10 FL23

12h 12-16o Rn25% 1-4mm W18-30 Cld60% CB10 FL22

Rn=Rain W=Wind Cld=Cloud
CB=CloudBase FL=Freeze(x100m)`,
    watch: `CAST12 -41.89, 146.08
Elevation: 863m

06h 5-7o Rn15% 0-1mm
W12-20 CB12 FL28

07h 6-8o Rn15% 0-1mm
W13-21 CB12 FL27

08h 7-10o Rn18% 0-2mm
W14-22 CB12 FL26

09h 9-12o Rn20% 0-2mm
W15-24 CB11 FL25`,
  },
];

function DevicePreviews() {
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'sending' | 'response'>('typing');
  const [typedChars, setTypedChars] = useState(0);

  const current = demoSequence[sequenceIndex];
  const command = current.command;

  // Use refs to avoid stale closure issues
  const phaseRef = useRef(phase);
  const typedCharsRef = useRef(typedChars);
  const sequenceIndexRef = useRef(sequenceIndex);

  phaseRef.current = phase;
  typedCharsRef.current = typedChars;
  sequenceIndexRef.current = sequenceIndex;

  useEffect(() => {
    const commandLength = demoSequence[sequenceIndexRef.current].command.length;

    const tick = () => {
      const currentPhase = phaseRef.current;
      const currentTyped = typedCharsRef.current;
      const currentCommand = demoSequence[sequenceIndexRef.current].command;

      if (currentPhase === 'typing') {
        if (currentTyped < currentCommand.length) {
          setTypedChars(prev => prev + 1);
        } else {
          setPhase('sending');
        }
      } else if (currentPhase === 'sending') {
        setPhase('response');
      } else if (currentPhase === 'response') {
        // Move to next in sequence
        const nextIndex = (sequenceIndexRef.current + 1) % demoSequence.length;
        setSequenceIndex(nextIndex);
        setPhase('typing');
        setTypedChars(0);
      }
    };

    // Different intervals for different phases
    const getInterval = () => {
      if (phaseRef.current === 'typing') return 80; // typing speed
      if (phaseRef.current === 'sending') return 800; // pause before response
      return 4000; // show response for 4 seconds
    };

    const interval = setInterval(tick, getInterval());
    return () => clearInterval(interval);
  }, [phase]); // Re-create interval when phase changes to get new timing

  const displayedCommand = command.slice(0, typedChars);

  return (
    <div className="mb-8 md:mb-12">
      <div className="flex flex-col md:flex-row justify-center items-center gap-6 md:gap-8">
        {/* iPhone */}
        <div className="flex flex-col items-center">
          <div className="text-center mb-3">
            <span className="text-xs font-medium text-zinc-500 bg-zinc-100 px-3 py-1 rounded-full transition-all">
              {phase === 'response' ? current.label : 'Live Demo'}
            </span>
          </div>
          <div className="w-[260px] h-[520px] bg-zinc-900 rounded-[40px] p-3 shadow-2xl shadow-zinc-900/20 relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-zinc-900 rounded-b-2xl" />
            <div className="w-full h-full bg-zinc-50 rounded-[32px] overflow-hidden flex flex-col">
              <div className="bg-zinc-100 pt-10 pb-2 px-4 text-center border-b border-zinc-200">
                <span className="text-zinc-900 text-sm font-medium">Thunderbird</span>
              </div>
              <div className="flex-1 p-3 overflow-hidden flex flex-col justify-start gap-2">
                {/* User's sent message */}
                {(phase === 'typing' || phase === 'sending') && (
                  <div className="flex justify-end">
                    <div className="bg-orange-500 text-white p-3 rounded-2xl rounded-br-sm max-w-[85%] text-xs font-mono min-w-[20px] min-h-[20px]">
                      {displayedCommand || '\u00A0'}
                      {phase === 'typing' && <span className="animate-pulse">|</span>}
                    </div>
                  </div>
                )}
                {phase === 'sending' && (
                  <div className="flex justify-end">
                    <span className="text-[10px] text-zinc-400 mr-2">Sending via satellite...</span>
                  </div>
                )}
                {/* Response */}
                {phase === 'response' && (
                  <>
                    <div className="flex justify-end mb-1">
                      <div className="bg-orange-500 text-white p-2 rounded-2xl rounded-br-sm text-xs font-mono">
                        {command}
                      </div>
                    </div>
                    <div className="bg-zinc-200 text-zinc-800 rounded-2xl rounded-bl-sm max-w-[95%] overflow-hidden max-h-[280px]">
                      <div className="p-3 text-xs leading-relaxed font-mono whitespace-pre-wrap animate-scroll-up">
                        {current.phone}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <span className="text-zinc-400 text-xs mt-4">iPhone 14+</span>
        </div>

        {/* Apple Watch */}
        <div className="flex flex-col items-center">
          <div className="text-center mb-3">
            <span className="text-xs font-medium text-zinc-500 bg-zinc-100 px-3 py-1 rounded-full transition-all">
              {phase === 'response' ? current.label : 'Live Demo'}
            </span>
          </div>
          <div className="w-[260px] h-[320px] bg-zinc-800 rounded-[44px] p-2 shadow-xl shadow-zinc-900/20 border-2 border-zinc-700 relative">
            <div className="absolute right-[-6px] top-20 w-2 h-10 bg-zinc-600 rounded-r-sm" />
            <div className="w-full h-full bg-black rounded-[38px] overflow-hidden flex flex-col p-3 justify-end">
              {/* User's sent message */}
              {(phase === 'typing' || phase === 'sending') && (
                <div className="mb-2">
                  <div className="bg-orange-500 text-white p-2 rounded-xl text-[10px] font-mono inline-block min-w-[16px] min-h-[16px]">
                    {displayedCommand || '\u00A0'}
                    {phase === 'typing' && <span className="animate-pulse">|</span>}
                  </div>
                  {phase === 'sending' && (
                    <div className="text-[9px] text-zinc-500 mt-1">Sending...</div>
                  )}
                </div>
              )}
              {/* Response */}
              {phase === 'response' && (
                <div className="overflow-hidden max-h-[240px]">
                  <div className="text-zinc-100 text-[11px] leading-relaxed font-mono whitespace-pre-wrap animate-scroll-up-watch">
                    {current.watch}
                  </div>
                </div>
              )}
            </div>
          </div>
          <span className="text-zinc-400 text-xs mt-4">Apple Watch Ultra 3</span>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative pt-20 pb-6 lg:pt-32 lg:pb-40 overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-50 via-white to-white" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.08),transparent)]" />

      <div className="relative max-w-5xl mx-auto px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-medium tracking-tight text-center text-zinc-900 max-w-4xl mx-auto mb-2 leading-tight">
            Introducing Thunderbird.
          </h1>

          <p className="text-3xl md:text-4xl lg:text-5xl font-medium tracking-tight text-zinc-500 max-w-4xl mx-auto mb-2 leading-tight">
            Off grid hyper-detailed weather forecasts.
          </p>

          <p className="text-3xl md:text-4xl lg:text-5xl font-medium tracking-tight text-zinc-900 max-w-4xl mx-auto mb-6 leading-tight">
            Regular and Satellite SMS Support.
          </p>

          <ul className="text-lg text-zinc-600 max-w-2xl mx-auto mb-5 leading-relaxed space-y-3 text-left px-4">
            <li className="flex gap-3"><span className="w-2 h-2 bg-orange-500 rounded-sm shrink-0 mt-2"></span>Make better on trail decisions with the most up to date weather (forecast data updated hourly).</li>
            <li className="flex gap-3"><span className="w-2 h-2 bg-orange-500 rounded-sm shrink-0 mt-2"></span>12 important metrics in every forecast: temp, rain, snow, wind, cloud base, freezing level, and more.</li>
            <li className="flex gap-3"><span className="w-2 h-2 bg-orange-500 rounded-sm shrink-0 mt-2"></span>Forecasts based on this highest resolution data from official national weather services.</li>
            <li className="flex gap-3"><span className="w-2 h-2 bg-orange-500 rounded-sm shrink-0 mt-2"></span>Forecast any point on trail using either the GPS pin, your GPX file or drop a pin on any of our community uploaded trails.</li>
          </ul>
          <p className="text-3xl md:text-4xl lg:text-5xl font-medium tracking-tight text-zinc-900 max-w-4xl mx-auto mb-8 md:mb-10 leading-tight">
            No Device Cost. No Lock in Contracts.
          </p>

          {/* CTA after bullet points */}
          <div className="flex items-center justify-center mb-10">
            <BetaButton />
          </div>

          {/* SMS Weather Forecast Example Title */}
          <div className="text-center mb-6">
            <h3 className="text-sm font-semibold text-zinc-600 uppercase tracking-wide">SMS Weather Forecast Example</h3>
          </div>

          {/* Device Previews - Animated */}
          <DevicePreviews />

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-3">
            <BetaButton />
          </div>
        </div>
      </div>
    </section>
  )
}

function WhereItWorks() {
  return (
    <section id="where-it-works" className="py-24 bg-zinc-50 scroll-mt-20">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 mb-4">
            Where it works
          </h2>
          <p className="text-lg text-zinc-600 max-w-3xl mx-auto leading-relaxed">
            Thunderbird SMS forecasts work where you have regular cell coverage and in countries where satellite SMS coverage is provided. Satellite SMS coverage is rapidly evolving. Thunderbird will always work over regular SMS, check where satellite SMS coverage currently is with our checker below. This space is expanding rapidly, by the end of 2026 we expect most countries other than have some form of satellite SMS coverage.
          </p>
        </div>

        <SatelliteChecker />

        {/* Expandable sections */}
        <div className="mt-12 space-y-4 max-w-3xl mx-auto">
          <details className="bg-white rounded-lg border border-zinc-200 p-5">
            <summary className="font-medium text-zinc-900 cursor-pointer">
              Supported Devices
            </summary>
            <div className="mt-3 text-sm text-zinc-600 space-y-2">
              <p>
                <strong>iPhone:</strong> iPhone 14 and newer (all models).
              </p>
              <p>
                <strong>Android:</strong> Samsung Galaxy S21+, Google Pixel 9+, recent Motorola models, and more.
                List is growing. Must have latest OS update.
              </p>
            </div>
          </details>

          <details className="bg-white rounded-lg border border-zinc-200 p-5">
            <summary className="font-medium text-zinc-900 cursor-pointer">
              Supported Networks
            </summary>
            <div className="mt-3 text-sm text-zinc-600 space-y-2">
              <p>
                Two satellite pathways exist: Apple's built-in satellite (via Globalstar) on iPhones, and
                Starlink Direct-to-Cell which works through participating mobile carriers on both iPhone and Android.
              </p>
              <p>
                Major carriers in US (T-Mobile, AT&T, Verizon ~96% market share), Canada (Bell, Rogers, Telus ~90% market share),
                Australia (Telstra), and New Zealand (One NZ) support satellite messaging. More carriers joining through 2026.
              </p>
            </div>
          </details>

          <details className="bg-white rounded-lg border border-zinc-200 p-5">
            <summary className="font-medium text-zinc-900 cursor-pointer">
              Supported Countries
            </summary>
            <div className="mt-3 text-sm text-zinc-600 space-y-2">
              <p>
                <strong>Apple satellite messaging</strong> currently works in USA, Canada, Mexico, and Japan.
              </p>
              <p>
                <strong>Starlink Direct-to-Cell</strong> is live in USA, Australia (Telstra, launched June 2025),
                New Zealand, and Ukraine, with Canada, Japan, Switzerland, UK, Chile, Peru, and Spain launching through 2026.
              </p>
              <p className="text-emerald-700 font-medium">
                Coverage expanding rapidly.
              </p>
            </div>
          </details>
        </div>

        <p className="text-lg text-zinc-600 max-w-3xl mx-auto leading-relaxed text-center mt-12">
          SMS is prioritised when off grid (i.e. satellite networks). Data and voice is often not available. When data is available, a single forecast uses less than 1KB vs 500Mb to open a weather page (difficult to do on 1 bar reception).
        </p>

        <div className="text-center mt-8">
          <BetaButton />
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const optionA = [
    {
      icon: Navigation,
      step: '01',
      title: 'Set waypoints',
      description: 'Mark camps, peaks, and key locations along your route with precise elevations.'
    },
    {
      icon: Save,
      step: '02',
      title: 'Save your route',
      description: 'Each waypoint gets a unique SMS code. Upload GPX or build from scratch.'
    },
    {
      icon: MessageSquare,
      step: '03',
      title: 'Request forecasts',
      description: 'Text your waypoint code via satellite SMS. Receive detailed weather within minutes.'
    }
  ];

  return (
    <section id="how-it-works" className="pt-12 pb-24 md:py-24 bg-white scroll-mt-20">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 mb-4">
            How it works
          </h2>
          <p className="text-zinc-500 max-w-xl mx-auto">
            Two ways to get forecasts: pre-configure your route or text GPS coordinates on the fly.
          </p>
        </div>

        {/* Pre-configure route */}
        <div className="mb-12">
          <p className="text-sm font-semibold text-zinc-600 uppercase tracking-wide mb-2 text-center">Pre-configure before departure</p>
          <p className="text-sm text-zinc-500 mb-6 text-center max-w-2xl mx-auto">Upload your own GPX file or use one of our community uploaded GPX files for your favourite trail.</p>
          <div className="grid md:grid-cols-3 gap-8">
            {optionA.map((item, i) => (
              <div key={i} className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center mb-5">
                    <item.icon className="w-5 h-5 text-zinc-600" />
                  </div>
                  <span className="text-xs font-medium text-zinc-400 mb-2">{item.step}</span>
                  <h3 className="text-lg font-medium text-zinc-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-zinc-500 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-zinc-200 pt-12">
          <p className="text-sm font-semibold text-zinc-600 uppercase tracking-wide mb-6 text-center">Or text GPS coordinates on trail</p>
          <div className="max-w-xl mx-auto text-center">
            <p className="text-zinc-600 mb-4">
              No pre-planning needed. Text your GPS coordinates from anywhere and get an instant forecast. Get GPS coordinates from your phone's compass app, Apple Maps, or Google Maps - GPS works even without cell coverage or data.
            </p>
            <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-4 font-mono text-sm mb-6">
              <span className="text-zinc-500">Send:</span> <span className="text-zinc-900">CAST12 -41.89, 146.08</span>
            </div>
            <ul className="text-lg text-zinc-600 max-w-2xl mx-auto leading-relaxed space-y-3 text-left">
              <li className="flex items-center justify-center gap-3"><span className="w-2 h-2 bg-orange-500 rounded-sm shrink-0 mt-2"></span>Unplanned detours or route changes.</li>
              <li className="flex items-center justify-center gap-3"><span className="w-2 h-2 bg-orange-500 rounded-sm shrink-0 mt-2"></span>Checking conditions at your current position.</li>
              <li className="flex items-center justify-center gap-3"><span className="w-2 h-2 bg-orange-500 rounded-sm shrink-0 mt-2"></span>Exploring new areas without pre-setup.</li>
            </ul>
          </div>
        </div>

        <div className="text-center mt-12">
          <BetaButton />
        </div>
      </div>
    </section>
  )
}

// Waypoint data
const overlandCamps = [
  { id: '1', name: 'Ronny Creek', smsCode: 'RONNY', lat: -41.6504, lng: 145.9614, elevation: 942, type: 'camp' as const },
  { id: '2', name: 'Waterfall Valley Hut', smsCode: 'WATER', lat: -41.7147, lng: 145.9469, elevation: 1020, type: 'camp' as const },
  { id: '3', name: 'Lake Windermere Hut', smsCode: 'WINDM', lat: -41.7641, lng: 145.9498, elevation: 993, type: 'camp' as const },
  { id: '4', name: 'New Pelion Hut', smsCode: 'PELIO', lat: -41.8295, lng: 146.0464, elevation: 739, type: 'camp' as const },
  { id: '5', name: 'Kia Ora Hut', smsCode: 'KIAOR', lat: -41.8921, lng: 146.0820, elevation: 863, type: 'camp' as const },
  { id: '6', name: 'Bert Nichols Hut', smsCode: 'BERTN', lat: -41.9321, lng: 146.0889, elevation: 1000, type: 'camp' as const },
  { id: '7', name: 'Narcissus Hut', smsCode: 'NARCI', lat: -41.9958, lng: 146.1667, elevation: 752, type: 'camp' as const },
];

const overlandPeaks = [
  { id: '8', name: 'Cradle Mountain', smsCode: 'CRADL', lat: -41.6848, lng: 145.9511, elevation: 1545, type: 'peak' as const },
  { id: '9', name: 'Marions Lookout', smsCode: 'MARIO', lat: -41.6607, lng: 145.9525, elevation: 1224, type: 'peak' as const },
  { id: '10', name: 'Barn Bluff', smsCode: 'BARNB', lat: -41.7244, lng: 145.9225, elevation: 1559, type: 'peak' as const },
  { id: '11', name: 'Mt Oakleigh', smsCode: 'OAKLE', lat: -41.7998, lng: 146.0369, elevation: 1286, type: 'peak' as const },
  { id: '12', name: 'Mt Pelion West', smsCode: 'PELOW', lat: -41.8319, lng: 145.9793, elevation: 1560, type: 'peak' as const },
  { id: '13', name: 'Mt Pelion East', smsCode: 'PELOE', lat: -41.8574, lng: 146.0675, elevation: 1461, type: 'peak' as const },
  { id: '14', name: 'Mt Ossa', smsCode: 'OSSAM', lat: -41.8713, lng: 146.0333, elevation: 1617, type: 'peak' as const },
  { id: '15', name: 'The Acropolis', smsCode: 'ACROP', lat: -41.9534, lng: 146.0645, elevation: 1471, type: 'peak' as const },
];

const overlandPois = [
  { id: '16', name: 'Kitchen Hut', smsCode: 'KITCH', lat: -41.6866, lng: 145.9481, elevation: 1200, type: 'poi' as const },
];

const allOverlandWaypoints = [...overlandCamps, ...overlandPeaks, ...overlandPois];

const overlandTrackGeojson: GeoJSON.Feature = {
  type: 'Feature',
  properties: { name: 'Overland Track' },
  geometry: {
    type: 'LineString',
    coordinates: [
      [145.9614, -41.6504], [145.9525, -41.6607], [145.9469, -41.7147],
      [145.9498, -41.7641], [146.0100, -41.8000], [146.0464, -41.8295],
      [146.0820, -41.8921], [146.0889, -41.9321], [146.1200, -41.9600],
      [146.1667, -41.9958],
    ]
  }
};

const TYPE_COLORS = {
  camp: '#22c55e',
  peak: '#64748b',
  poi: '#6366f1'
};

function GlobalCoverage() {
  const markets = [
    { country: 'Australia', resolution: '2.2km × 2.2km' },
    { country: 'USA', resolution: '2.5km × 2.5km' },
    { country: 'Canada', resolution: '2.5km × 2.5km' },
    { country: 'UK', resolution: '1.5km × 1.5km' },
    { country: 'France', resolution: '1.5km × 1.5km' },
    { country: 'Switzerland', resolution: '2.0km × 2.0km' },
    { country: 'Italy', resolution: '7.0km × 7.0km' },
    { country: 'Japan', resolution: '5.0km × 5.0km' },
    { country: 'New Zealand', resolution: '9.0km × 9.0km' },
    { country: 'South Africa', resolution: '9.0km × 9.0km' },
  ];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 mb-4">
            High resolution global coverage
          </h2>
          <p className="text-zinc-500 max-w-xl mx-auto">
            Official weather models from national meteorological services.
          </p>
        </div>

        {/* Mobile: 3-column grid */}
        <div className="grid grid-cols-3 gap-2 md:hidden">
          {markets.map((market) => (
            <div
              key={market.country}
              className="bg-zinc-50 rounded-lg p-3 text-center border border-zinc-100"
            >
              <div className="text-xs font-semibold text-zinc-900 truncate">{market.country}</div>
              <div className="text-[10px] text-zinc-500 mt-1 whitespace-nowrap">{market.resolution}</div>
            </div>
          ))}
        </div>

        {/* Desktop: grid layout */}
        <div className="hidden md:block">
          <div className="grid grid-cols-5 gap-6 max-w-4xl mx-auto">
            {markets.map((market) => (
              <div key={market.country} className="text-center">
                <div className="font-semibold text-zinc-900 text-sm mb-2">
                  {market.country}
                </div>
                <div className="text-zinc-500 text-sm">
                  {market.resolution}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-zinc-400 mt-6">
          Resolution = weather model grid size. Smaller = more accurate for mountain terrain.
        </p>

        <div className="text-center mt-10">
          <BetaButton />
        </div>
      </div>
    </section>
  )
}

function RouteExample() {
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(null);
  const selectedWaypoint = allOverlandWaypoints.find(w => w.id === selectedWaypointId);

  return (
    <section id="see-it-in-action" className="py-24 bg-white scroll-mt-20">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 mb-4">
            See it in action
          </h2>
          <p className="text-zinc-500 max-w-xl mx-auto">
            The Overland Track with 16 waypoints. Click any marker to see its SMS code.
          </p>
        </div>

        <div className="bg-zinc-50 rounded-2xl border border-zinc-200 p-4 mb-6">
          <MapEditor
            trackGeojson={overlandTrackGeojson}
            waypoints={allOverlandWaypoints}
            selectedWaypointId={selectedWaypointId}
            onWaypointSelect={setSelectedWaypointId}
            initialViewport={{ latitude: -41.82, longitude: 146.0, zoom: 9 }}
          />

          <div className="mt-4 flex flex-wrap justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-zinc-600">Camps ({overlandCamps.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-slate-500" />
              <span className="text-zinc-600">Peaks ({overlandPeaks.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-indigo-500" />
              <span className="text-zinc-600">POI ({overlandPois.length})</span>
            </div>
          </div>
        </div>

        {selectedWaypoint && (
          <div className="bg-white rounded-xl border-2 border-zinc-900 p-4 mb-6">
            <div className="flex items-center justify-center gap-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-medium"
                style={{ backgroundColor: TYPE_COLORS[selectedWaypoint.type] }}
              >
                {selectedWaypoint.smsCode.slice(0, 3)}
              </div>
              <div className="text-center">
                <h3 className="font-medium text-zinc-900">{selectedWaypoint.name}</h3>
                <p className="text-sm text-zinc-500">
                  Text <code className="bg-zinc-100 px-2 py-0.5 rounded font-mono text-zinc-700">{selectedWaypoint.smsCode}</code> for weather
                  <span className="text-zinc-400 ml-2">• {selectedWaypoint.elevation}m</span>
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4 mb-10">
          <div className="bg-white rounded-xl border border-zinc-200 p-5">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Tent className="w-4 h-4 text-emerald-600" />
              <h3 className="font-medium text-zinc-900">Camps</h3>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-sm">
              {overlandCamps.map((camp) => (
                <button
                  key={camp.id}
                  onClick={() => setSelectedWaypointId(camp.id)}
                  className={`flex items-center justify-center gap-2 p-2 rounded-lg transition-colors ${
                    selectedWaypointId === camp.id ? 'bg-emerald-50' : 'hover:bg-zinc-50'
                  }`}
                >
                  <code className="text-emerald-600 font-mono text-xs">{camp.smsCode}</code>
                  <span className="text-zinc-600 truncate text-xs">{camp.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 p-5">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Mountain className="w-4 h-4 text-slate-600" />
              <h3 className="font-medium text-zinc-900">Peaks</h3>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-sm">
              {overlandPeaks.map((peak) => (
                <button
                  key={peak.id}
                  onClick={() => setSelectedWaypointId(peak.id)}
                  className={`flex items-center justify-center gap-2 p-2 rounded-lg transition-colors ${
                    selectedWaypointId === peak.id ? 'bg-slate-50' : 'hover:bg-zinc-50'
                  }`}
                >
                  <code className="text-slate-600 font-mono text-xs">{peak.smsCode}</code>
                  <span className="text-zinc-600 truncate text-xs">{peak.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center">
          <BetaButton />
        </div>
      </div>
    </section>
  )
}

function Features() {
  const features = [
    { icon: Clock, title: 'Hour-by-hour', description: 'Hour-by-hour intervals so you know exactly when conditions change.', code: '06h' },
    { icon: Thermometer, title: 'Temperature', description: 'Min-max range adjusted for your exact elevation using atmospheric lapse rates.', code: '5-7°' },
    { icon: Droplets, title: 'Rain', description: 'Probability and expected accumulation in millimeters.', code: 'Rn25% 0-3mm' },
    { icon: Snowflake, title: 'Snow', description: 'Accumulation in centimeters when temperatures drop.', code: 'Sn0-2cm' },
    { icon: Wind, title: 'Wind speed', description: 'Sustained and gust speeds — critical for exposed ridgelines.', code: 'W18-30' },
    { icon: Compass, title: 'Wind direction', description: 'Know which slopes are sheltered and which are exposed.', code: 'NW' },
    { icon: Cloud, title: 'Cloud cover', description: 'How much sky is covered. Plan your visibility windows.', code: 'Cld60%' },
    { icon: Mountain, title: 'Cloud base', description: "The altitude where clouds begin. Know when you'll be in them.", code: 'CB14' },
    { icon: Snowflake, title: 'Freezing level', description: 'The altitude where temperatures drop below freezing.', code: 'FL18' },
    { icon: Sun, title: 'Light hours', description: 'Sunrise to sunset times so you can plan your start and finish.', code: '06:00-20:51' },
    { icon: Zap, title: 'Thunderstorm risk', description: 'CAPE-based storm probability — get off exposed ridges in time.', code: 'TS!' },
    { icon: AlertTriangle, title: 'Danger rating', description: 'Ice, whiteout, extreme wind, and storm risk — flagged at a glance.', code: '!!!' },
  ]

  return (
    <section id="features" className="py-24 bg-zinc-50 scroll-mt-20">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 mb-4">
            What&apos;s in the forecast
          </h2>
          <p className="text-zinc-500 max-w-xl mx-auto">
            Every metric you need to plan your day out on trail, optimized for SMS delivery.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature, i) => (
            <div key={i} className="bg-white rounded-xl border border-zinc-200 p-5 text-center">
              <div className="flex items-center justify-center gap-3 mb-3">
                <feature.icon className="w-5 h-5 text-zinc-400" />
                <code className="text-xs font-mono text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">{feature.code}</code>
              </div>
              <h3 className="font-medium text-zinc-900 mb-1">{feature.title}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Value Proposition - Complexity Statement */}
        <div className="mt-16 bg-white rounded-2xl border border-zinc-200 p-8 md:p-10">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 bg-orange-50 rounded-xl shrink-0">
              <Database className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                What&apos;s in our weather forecast
              </h3>
              <p className="text-zinc-600 leading-relaxed">
                Each forecast is synthesized from multiple national meteorological services — not generic third-party data.
                We query official APIs from the Bureau of Meteorology, National Weather Service, Met Office, Météo-France,
                MeteoSwiss, and others depending on your location.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div className="space-y-2">
              <div className="font-medium text-zinc-900">Elevation precision</div>
              <p className="text-zinc-500">
                We sample 49 elevation points across each weather grid cell to calculate the true model orography,
                then apply atmospheric lapse rates (6.5°C per 1000m) to adjust temperatures for your exact position.
              </p>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-zinc-900">Cloud base calculation</div>
              <p className="text-zinc-500">
                Cloud base heights are derived using the Lifting Condensation Level formula from temperature and dewpoint data —
                the same method pilots use for flight planning.
              </p>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-zinc-900">Intelligent danger rating</div>
              <p className="text-zinc-500">
                Our algorithm evaluates ice risk, whiteout conditions, wind exposure, precipitation intensity, and convective energy (CAPE)
                to generate a single at-a-glance danger indicator.
              </p>
            </div>
          </div>

          <p className="text-xs text-zinc-400 mt-6 pt-6 border-t border-zinc-100 text-center">
            All of this computation happens in real-time, then gets compressed into an SMS that works on any device — even via satellite.
          </p>
        </div>

        <div className="text-center mt-12">
          <BetaButton />
        </div>
      </div>
    </section>
  )
}

function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-white scroll-mt-20">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 mb-4">
            Simple pricing
          </h2>
          <p className="text-zinc-500 max-w-xl mx-auto">
            USD $29.99 up front with USD $29.99 of SMS credits included. Top up anytime with pay-as-you-go credits.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto items-stretch">
          {/* Thunderbird */}
          <div className="bg-zinc-900 rounded-2xl p-6 text-white shadow-xl shadow-orange-500/20 ring-2 ring-orange-500 flex flex-col">
            <div className="text-center mb-6">
              <Zap className="w-8 h-8 text-orange-500 mx-auto mb-3" />
              <h3 className="text-lg font-medium">Thunderbird</h3>
            </div>
            <div className="space-y-3 text-sm flex-1">
              <div className="flex justify-between py-2 border-b border-zinc-700">
                <span className="text-zinc-400">Device</span>
                <span className="font-medium">USD $0</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-700">
                <span className="text-zinc-400">Monthly</span>
                <span className="font-medium">USD $0</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-700">
                <span className="text-zinc-400">1st Month</span>
                <span className="font-medium">USD $29.99</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-700">
                <span className="text-zinc-400">Per forecast</span>
                <span className="font-medium">USD $0.33</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-zinc-400">12 month minimum</span>
                <span className="font-medium">USD $29.99</span>
              </div>
            </div>
            <BetaButton className="btn-orange block w-full text-center mt-6">Apply for Beta</BetaButton>
          </div>

          {/* Garmin */}
          <div className="bg-white rounded-2xl border border-zinc-200 p-6 flex flex-col">
            <div className="text-center mb-6">
              <Satellite className="w-8 h-8 text-zinc-400 mx-auto mb-3" />
              <div className="flex items-center justify-center gap-2">
                <h3 className="text-lg font-medium text-zinc-900">Garmin inReach</h3>
                <a
                  href="https://www.garmin.com/en-US/p/837461/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative"
                  title="Based on cheapest plan: Enabled (USD $7.99/mo) + device (USD $350+) + activation (USD $39.99). View official pricing →"
                >
                  <Info className="w-4 h-4 text-zinc-400 hover:text-zinc-600 cursor-help" />
                </a>
              </div>
            </div>
            <div className="space-y-3 text-sm flex-1">
              <div className="flex justify-between py-2 border-b border-zinc-100">
                <span className="text-zinc-500">Device</span>
                <span className="font-medium text-zinc-900">USD $350+</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-100">
                <span className="text-zinc-500">Monthly</span>
                <span className="font-medium text-zinc-900">USD $7.99–$50</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-100">
                <span className="text-zinc-500">1st Month</span>
                <span className="font-medium text-zinc-900">USD $390+</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-100">
                <span className="text-zinc-500">Per forecast</span>
                <span className="font-medium text-zinc-900">Up to USD $0.50</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-zinc-500">12 month minimum</span>
                <span className="font-medium text-zinc-900">USD $486+</span>
              </div>
            </div>
            <div className="w-full bg-zinc-100 text-zinc-400 font-medium py-3 rounded-xl text-center text-sm mt-6">
              External provider
            </div>
          </div>

          {/* Zoleo */}
          <div className="bg-white rounded-2xl border border-zinc-200 p-6 flex flex-col">
            <div className="text-center mb-6">
              <MessageSquare className="w-8 h-8 text-zinc-400 mx-auto mb-3" />
              <div className="flex items-center justify-center gap-2">
                <h3 className="text-lg font-medium text-zinc-900">Zoleo</h3>
                <a
                  href="https://www.zoleo.com/en-us/plans"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative"
                  title="Based on cheapest plan: Basic (USD $20/mo) + device (USD $200) + activation (USD $39.99). View official pricing →"
                >
                  <Info className="w-4 h-4 text-zinc-400 hover:text-zinc-600 cursor-help" />
                </a>
              </div>
            </div>
            <div className="space-y-3 text-sm flex-1">
              <div className="flex justify-between py-2 border-b border-zinc-100">
                <span className="text-zinc-500">Device</span>
                <span className="font-medium text-zinc-900">USD $200</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-100">
                <span className="text-zinc-500">Monthly</span>
                <span className="font-medium text-zinc-900">USD $20–$50</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-100">
                <span className="text-zinc-500">1st Month</span>
                <span className="font-medium text-zinc-900">USD $240+</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-100">
                <span className="text-zinc-500">Per forecast</span>
                <span className="font-medium text-zinc-900">Up to USD $0.27</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-zinc-500">12 month minimum</span>
                <span className="font-medium text-zinc-900">USD $480+</span>
              </div>
            </div>
            <div className="w-full bg-zinc-100 text-zinc-400 font-medium py-3 rounded-xl text-center text-sm mt-6">
              External provider
            </div>
          </div>
        </div>

        <div className="text-center mt-10">
          <BetaButton />
        </div>
      </div>
    </section>
  )
}

function About() {
  return (
    <section id="about" className="py-24 bg-zinc-50 scroll-mt-20">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 mb-4">
            About Thunderbird
          </h2>
        </div>

        <div className="space-y-6 text-zinc-600 text-center">
          <p className="text-lg leading-relaxed">
            Thunderbird is an AI agent built by{' '}
            <a
              href="https://www.linkedin.com/in/andrewcwhall/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-600 hover:text-orange-700 font-medium inline-flex items-center gap-1"
            >
              Andrew Hall
              <ExternalLink className="w-4 h-4" />
            </a>
            , an avid AI entrepreneur and hiker.
          </p>

          <p className="text-lg leading-relaxed">
            Thunderbird exists because getting detailed weather on trail shouldn&apos;t require
            a specialist device or a monthly subscription. It delivers the data you need to
            decide when to go and when to stay — directly to the satellite-enabled phone or
            watch you already carry.
          </p>

          <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Mail className="w-5 h-5 text-orange-600" />
              <span className="font-semibold text-zinc-900">Get in Touch</span>
            </div>
            <p className="text-zinc-700">
              Come say hi at{' '}
              <a
                href="mailto:hello@thunderbird.bot"
                className="text-orange-600 hover:text-orange-700 font-medium"
              >
                hello@thunderbird.bot
              </a>
              {' '}— see you out on trail soon.
            </p>
          </div>

          <div className="text-center mt-10">
            <BetaButton />
          </div>
        </div>
      </div>
    </section>
  )
}

const faqData = [
  {
    question: "What phones work with Thunderbird?",
    answer: "Thunderbird works with any phone that supports satellite SMS, including iPhone 14 and newer, Apple Watch Ultra 3, and select Android phones in select geographical markets (Pixel 9+, Galaxy S24+/S25+). Check out our 'Where it Works' to check your own individual circumstances."
  },
  {
    question: "How does satellite SMS delivery work?",
    answer: "Text your waypoint code to our service number. Your phone routes the message through satellite when out of cell range. You receive a detailed weather forecast within minutes — no app or internet required."
  },
  {
    question: "What weather data is included?",
    answer: "Each forecast includes 12 metrics per hour: temperature (elevation-adjusted), rain probability and accumulation, snow accumulation, wind speed and direction, cloud cover, cloud base height, freezing level, light hours (sunrise/sunset), thunderstorm risk indicators, and an overall danger rating for hazardous conditions."
  },
  {
    question: "Do I need a subscription?",
    answer: "No. Thunderbird is a one-time USD $29.99 purchase that includes USD $29.99 in SMS credits. Top up only when you need more. Credits never expire."
  },
  {
    question: "How much does each forecast cost?",
    answer: "Each forecast starts at USD $0.33 (12 hr hourly and 7 day daily). 24hr hourly forecasts are double the length of a standard SMS so cost twice as much. The USD $29.99 starter credits cover approximately 90 standard forecasts. Top up anytime with USD $10, USD $25 or USD $50 SMS credits — credits never expire."
  },
  {
    question: "Can I create custom routes?",
    answer: "Yes. Upload your own GPX file or build from scratch using our map editor. You can also start from popular trail templates and customize them."
  },
];

function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 bg-zinc-50 scroll-mt-20">
      <div className="max-w-2xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 mb-4">
            Questions
          </h2>
        </div>

        <div className="space-y-2">
          {faqData.map((faq, index) => (
            <div key={index} className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 hover:bg-zinc-50 transition-colors"
              >
                <span className="font-medium text-zinc-900 text-sm">{faq.question}</span>
                <span className="text-zinc-400 text-lg flex-shrink-0">
                  {openIndex === index ? '−' : '+'}
                </span>
              </button>
              <div className={`overflow-hidden transition-all duration-200 ${openIndex === index ? 'max-h-48' : 'max-h-0'}`}>
                <div className="px-5 pb-4 text-sm text-zinc-500 leading-relaxed">
                  {faq.answer}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <BetaButton />
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": faqData.map(faq => ({
              "@type": "Question",
              "name": faq.question,
              "acceptedAnswer": { "@type": "Answer", "text": faq.answer }
            }))
          })
        }}
      />
    </section>
  )
}

function FinalCTA() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-2xl mx-auto px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 mb-4">
          Ready to get started?
        </h2>
        <p className="text-zinc-500 mb-8">
          USD $29.99 one-time. Includes USD $29.99 SMS credits. No subscription.
        </p>
        <BetaButton className="btn-orange inline-flex items-center gap-2 px-8 py-4" />
      </div>
    </section>
  )
}

function HomeContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    initPathTracking(params);
    trackPageView('/');
  }, [searchParams]);

  return (
    <>
      <Hero />
      <WhereItWorks />
      <Features />
      <GlobalCoverage />
      <HowItWorks />
      <RouteExample />
      <Pricing />
      <About />
      <FAQ />
      <FinalCTA />
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
