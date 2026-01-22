'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link'
import dynamic from 'next/dynamic';
import { initPathTracking, trackPageView } from '@/app/lib/analytics';
import {
  Zap, Satellite, CloudRain, Shield, Bell, Clock,
  MapPin, Thermometer, Wind, Droplets, Mountain, Smartphone,
  Cloud, Snowflake, AlertTriangle, Navigation, Save, MessageSquare,
  Tent, BatteryCharging, ChevronRight
} from 'lucide-react'

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

function Hero() {
  return (
    <section className="relative pt-24 pb-32 lg:pt-32 lg:pb-40 overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-50 via-white to-white" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.08),transparent)]" />

      <div className="relative max-w-5xl mx-auto px-6 lg:px-8">
        <div className="text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 border border-zinc-200 text-sm text-zinc-600 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Satellite SMS Weather Forecasts
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-zinc-900 mb-6">
            Weather forecasts that
            <span className="block text-zinc-500">actually reach you</span>
          </h1>

          <p className="text-lg text-zinc-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            On-demand weather for any trail, delivered via satellite SMS.
            No cell coverage required. No subscription. Just accurate forecasts
            when and where you need them.
          </p>

          {/* Device Previews */}
          <div className="flex flex-col md:flex-row justify-center items-center gap-8 mb-12">
            {/* iPhone */}
            <div className="flex flex-col items-center">
              <div className="w-[260px] h-[520px] bg-zinc-900 rounded-[40px] p-3 shadow-2xl shadow-zinc-900/20 relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-zinc-900 rounded-b-2xl" />
                <div className="w-full h-full bg-zinc-50 rounded-[32px] overflow-hidden flex flex-col">
                  <div className="bg-zinc-100 pt-10 pb-2 px-4 text-center border-b border-zinc-200">
                    <span className="text-zinc-900 text-sm font-medium">Thunderbird</span>
                  </div>
                  <div className="flex-1 p-3 overflow-hidden">
                    <div className="bg-zinc-200 text-zinc-800 p-3 rounded-2xl rounded-bl-sm max-w-[95%] text-xs leading-relaxed font-mono animate-scroll-up whitespace-pre-wrap">
{`CAST LAKEO 863m
Light 06:00-20:51

06h 5-7o Rn15% 0-1mm W12-20 Cld40% CB12 FL28

07h 6-8o Rn15% 0-1mm W13-21 Cld42% CB12 FL27

08h 7-10o Rn18% 0-2mm W14-22 Cld45% CB12 FL26

09h 9-12o Rn20% 0-2mm W15-24 Cld48% CB11 FL25

10h 10-14o Rn22% 0-3mm W16-26 Cld52% CB11 FL24

11h 11-15o Rn24% 0-3mm W17-28 Cld56% CB10 FL23

12h 12-16o Rn25% 1-4mm W18-30 Cld60% CB10 FL22

Rn=Rain W=Wind Cld=Cloud
CB=CloudBase FL=Freeze(x100m)`}
                    </div>
                  </div>
                </div>
              </div>
              <span className="text-zinc-400 text-xs mt-4">iPhone 14+</span>
            </div>

            {/* Apple Watch */}
            <div className="flex flex-col items-center">
              <div className="w-[160px] h-[200px] bg-zinc-800 rounded-[36px] p-2 shadow-xl shadow-zinc-900/20 border-2 border-zinc-700 relative">
                <div className="absolute right-[-4px] top-14 w-1.5 h-6 bg-zinc-600 rounded-r-sm" />
                <div className="w-full h-full bg-black rounded-[30px] overflow-hidden flex flex-col p-2">
                  <div className="text-zinc-100 text-[8px] leading-tight font-mono animate-scroll-up-watch whitespace-pre-wrap">
{`CAST LAKEO 863m

06h 5-7o Rn15% 0-1mm
W12-20 CB12 FL28

07h 6-8o Rn15% 0-1mm
W13-21 CB12 FL27

08h 7-10o Rn18% 0-2mm
W14-22 CB12 FL26

09h 9-12o Rn20% 0-2mm
W15-24 CB11 FL25`}
                  </div>
                </div>
              </div>
              <span className="text-zinc-400 text-xs mt-4">Apple Watch Ultra</span>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link
              href="/checkout?path=buy"
              className="btn-orange inline-flex items-center gap-2 px-8 py-3.5"
            >
              Buy Now
              <ChevronRight className="w-4 h-4" />
            </Link>
            <Link
              href="/create?path=create"
              className="inline-flex items-center gap-2 text-zinc-600 hover:text-zinc-900 font-medium px-6 py-3.5 transition-colors"
            >
              Create your route first
            </Link>
          </div>

          <p className="text-xs text-zinc-400 max-w-lg mx-auto">
            Works with iPhone 14+, Apple Watch Ultra, and satellite-enabled Android devices.
            <Link href="/compatibility" className="text-zinc-500 hover:text-zinc-700 ml-1 underline underline-offset-2">
              Check compatibility
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
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
    <section className="py-24 bg-white">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 mb-4">
            How it works
          </h2>
          <p className="text-zinc-500 max-w-xl mx-auto">
            Three steps to weather intelligence on any trail, anywhere in the world.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((item, i) => (
            <div key={i} className="relative">
              <div className="flex flex-col items-start">
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

        <div className="text-center mt-12">
          <Link
            href="/checkout?path=buy"
            className="btn-orange inline-flex items-center gap-2 px-8 py-3.5"
          >
            Buy Now
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}

function WhySMS() {
  const benefits = [
    {
      icon: Satellite,
      title: "Works everywhere",
      description: "Satellite SMS reaches you anywhere with sky visibility — no cell towers needed."
    },
    {
      icon: BatteryCharging,
      title: "Battery efficient",
      description: "SMS uses minimal power compared to data. Your phone lasts longer on trail."
    },
    {
      icon: Shield,
      title: "Reliable delivery",
      description: "SMS is prioritized over data. Your forecast gets through even in congested areas."
    }
  ];

  return (
    <section className="py-24 bg-zinc-50">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 mb-4">
            Why SMS?
          </h2>
          <p className="text-zinc-500 max-w-xl mx-auto">
            Small payload, prioritized delivery, works with brief satellite visibility.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {benefits.map((benefit, i) => (
            <div key={i} className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center mb-4">
                <benefit.icon className="w-5 h-5 text-zinc-600" />
              </div>
              <h3 className="font-medium text-zinc-900 mb-2">{benefit.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{benefit.description}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link
            href="/checkout?path=buy"
            className="btn-orange inline-flex items-center gap-2 px-8 py-3.5"
          >
            Buy Now
            <ChevronRight className="w-4 h-4" />
          </Link>
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
    { country: 'Australia', resolution: '3×3' },
    { country: 'USA', resolution: '2.5×2.5' },
    { country: 'Canada', resolution: '2.5×2.5' },
    { country: 'UK', resolution: 'Point', noKm: true },
    { country: 'France', resolution: '1.5×1.5' },
    { country: 'Switzerland', resolution: '1×1' },
    { country: 'Italy', resolution: '7×7' },
    { country: 'New Zealand', resolution: '4×4' },
    { country: 'South Africa', resolution: '11×11' },
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
              <div className="text-sm text-zinc-500 mt-1">{market.resolution}{!market.noKm && ' km'}</div>
            </div>
          ))}
        </div>

        {/* Desktop: horizontal table */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                {markets.map((market) => (
                  <th key={market.country} className="py-3 px-2 text-center font-semibold text-zinc-900 whitespace-nowrap">
                    {market.country}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {markets.map((market) => (
                  <td key={market.country} className="py-3 px-2 text-center text-zinc-500 whitespace-nowrap">
                    {market.resolution}{!market.noKm && ' km'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-center text-xs text-zinc-400 mt-6">
          Resolution = weather model grid size. Smaller = more accurate for mountain terrain.
        </p>

        <div className="text-center mt-10">
          <Link
            href="/checkout?path=buy"
            className="btn-orange inline-flex items-center gap-2 px-8 py-3.5"
          >
            Buy Now
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}

function RouteExample() {
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(null);
  const selectedWaypoint = allOverlandWaypoints.find(w => w.id === selectedWaypointId);

  return (
    <section className="py-24 bg-white">
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
            <div className="flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-medium"
                style={{ backgroundColor: TYPE_COLORS[selectedWaypoint.type] }}
              >
                {selectedWaypoint.smsCode.slice(0, 3)}
              </div>
              <div>
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
            <div className="flex items-center gap-2 mb-4">
              <Tent className="w-4 h-4 text-emerald-600" />
              <h3 className="font-medium text-zinc-900">Camps</h3>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-sm">
              {overlandCamps.map((camp) => (
                <button
                  key={camp.id}
                  onClick={() => setSelectedWaypointId(camp.id)}
                  className={`flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
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
            <div className="flex items-center gap-2 mb-4">
              <Mountain className="w-4 h-4 text-slate-600" />
              <h3 className="font-medium text-zinc-900">Peaks</h3>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-sm">
              {overlandPeaks.map((peak) => (
                <button
                  key={peak.id}
                  onClick={() => setSelectedWaypointId(peak.id)}
                  className={`flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
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
          <Link
            href="/checkout?path=buy"
            className="btn-orange inline-flex items-center gap-2 px-8 py-3.5"
          >
            Buy Now
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}

function Features() {
  const features = [
    { icon: Clock, title: 'Hour-by-hour', description: '2-hour intervals. Know exactly when conditions change.', code: '06h' },
    { icon: Thermometer, title: 'Temperature', description: 'Min-max adjusted for elevation (6.5°C/1000m lapse).', code: '5-7°' },
    { icon: Droplets, title: 'Precipitation', description: 'Rain/snow probability plus expected accumulation.', code: 'Rn25%' },
    { icon: Wind, title: 'Wind', description: 'Sustained and gust speeds. Critical for ridgelines.', code: 'W18-30' },
    { icon: Cloud, title: 'Cloud cover', description: 'Percentage of sky covered. Plan visibility.', code: 'Cld60%' },
    { icon: Mountain, title: 'Cloud base', description: 'Height where clouds begin (×100m).', code: 'CB14' },
    { icon: Snowflake, title: 'Freezing level', description: 'Altitude where temp hits 0°C (×100m).', code: 'FL18' },
    { icon: AlertTriangle, title: 'Danger flag', description: 'Warning for hazardous conditions.', code: '⚠' },
  ]

  return (
    <section className="py-24 bg-zinc-50">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 mb-4">
            What&apos;s in the forecast
          </h2>
          <p className="text-zinc-500 max-w-xl mx-auto">
            Every metric you need, optimized for SMS delivery.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature, i) => (
            <div key={i} className="bg-white rounded-xl border border-zinc-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <feature.icon className="w-5 h-5 text-zinc-400" />
                <code className="text-xs font-mono text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">{feature.code}</code>
              </div>
              <h3 className="font-medium text-zinc-900 mb-1">{feature.title}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link
            href="/checkout?path=buy"
            className="btn-orange inline-flex items-center gap-2 px-8 py-3.5"
          >
            Buy Now
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}

function Pricing() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 mb-4">
            Simple pricing
          </h2>
          <p className="text-zinc-500 max-w-xl mx-auto">
            One-time purchase. No subscription. No device to buy.
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
                <span className="font-medium">$0</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-700">
                <span className="text-zinc-400">Monthly</span>
                <span className="font-medium">$0</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-700">
                <span className="text-zinc-400">One-time</span>
                <span className="font-medium">$29.99</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-zinc-400">Per forecast</span>
                <span className="font-medium">$0.07–$0.87</span>
              </div>
            </div>
            <Link
              href="/checkout?path=buy"
              className="btn-orange block w-full text-center mt-6"
            >
              Buy Now
            </Link>
          </div>

          {/* Garmin */}
          <div className="bg-white rounded-2xl border border-zinc-200 p-6 flex flex-col">
            <div className="text-center mb-6">
              <Satellite className="w-8 h-8 text-zinc-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-zinc-900">Garmin inReach</h3>
            </div>
            <div className="space-y-3 text-sm flex-1">
              <div className="flex justify-between py-2 border-b border-zinc-100">
                <span className="text-zinc-500">Device</span>
                <span className="font-medium text-zinc-900">$399</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-100">
                <span className="text-zinc-500">Monthly</span>
                <span className="font-medium text-zinc-900">$15–$65</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-100">
                <span className="text-zinc-500">One-time</span>
                <span className="font-medium text-zinc-900">$414+</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-zinc-500">Per forecast</span>
                <span className="font-medium text-zinc-900">$1–$2</span>
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
              <h3 className="text-lg font-medium text-zinc-900">Zoleo</h3>
            </div>
            <div className="space-y-3 text-sm flex-1">
              <div className="flex justify-between py-2 border-b border-zinc-100">
                <span className="text-zinc-500">Device</span>
                <span className="font-medium text-zinc-900">$199</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-100">
                <span className="text-zinc-500">Monthly</span>
                <span className="font-medium text-zinc-900">$20–$50</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-100">
                <span className="text-zinc-500">One-time</span>
                <span className="font-medium text-zinc-900">$219+</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-zinc-500">Per forecast</span>
                <span className="font-medium text-zinc-900">$0.14–$0.80</span>
              </div>
            </div>
            <div className="w-full bg-zinc-100 text-zinc-400 font-medium py-3 rounded-xl text-center text-sm mt-6">
              External provider
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-zinc-400 mt-8">
          Already have a satellite device? Thunderbird works with your existing equipment.{' '}
          <Link href="/compatibility" className="text-zinc-500 hover:text-zinc-700 underline underline-offset-2">
            Check compatibility
          </Link>
        </p>

        <div className="text-center mt-10">
          <Link
            href="/checkout?path=buy"
            className="btn-orange inline-flex items-center gap-2 px-8 py-3.5"
          >
            Buy Now
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}

const faqData = [
  {
    question: "What phones work with Thunderbird?",
    answer: "Thunderbird works with any phone that supports satellite SMS, including iPhone 14 and newer, Apple Watch Ultra, and select Android phones on T-Mobile or Verizon (Pixel 9+, Galaxy S24+/S25+)."
  },
  {
    question: "How does satellite SMS delivery work?",
    answer: "Text your waypoint code to our service number. Your phone routes the message through satellite when out of cell range. You receive a detailed weather forecast within minutes — no app or internet required."
  },
  {
    question: "What weather data is included?",
    answer: "Each forecast includes hour-by-hour temperature (elevation-adjusted), rain/snow probability, wind speed, cloud cover, cloud base height, freezing level, and danger indicators for hazardous conditions."
  },
  {
    question: "Do I need a subscription?",
    answer: "No. Thunderbird is a one-time $29.99 purchase that includes $10 in SMS credits. Top up only when you need more. Credits never expire."
  },
  {
    question: "How much does each forecast cost?",
    answer: "Each forecast costs $0.07 to $0.87 depending on your country's SMS rates. The starter pack covers approximately 140 forecasts — enough for multiple week-long trips."
  },
  {
    question: "Can I create custom routes?",
    answer: "Yes. Upload your own GPX file or build from scratch using our map editor. You can also start from popular trail templates and customize them."
  },
];

function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-24 bg-zinc-50">
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
          <Link
            href="/checkout?path=buy"
            className="btn-orange inline-flex items-center gap-2 px-8 py-3.5"
          >
            Buy Now
            <ChevronRight className="w-4 h-4" />
          </Link>
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
          $29.99 one-time. Includes $10 SMS credits. No subscription.
        </p>
        <Link
          href="/checkout?path=buy"
          className="btn-orange inline-flex items-center gap-2 px-8 py-4"
        >
          Buy Now
          <ChevronRight className="w-4 h-4" />
        </Link>
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
      <HowItWorks />
      <WhySMS />
      <GlobalCoverage />
      <RouteExample />
      <Features />
      <Pricing />
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
