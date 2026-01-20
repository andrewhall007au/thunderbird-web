'use client';

import { useState } from 'react';
import Link from 'next/link'
import dynamic from 'next/dynamic';
import {
  Zap, Satellite, CloudRain, Shield, Bell, Clock,
  MapPin, Thermometer, Wind, Droplets, Mountain, Smartphone,
  Cloud, Snowflake, AlertTriangle, Navigation, Save, MessageSquare,
  Tent
} from 'lucide-react'

// Dynamic import for map to avoid SSR issues
const MapEditor = dynamic(() => import('./components/map/MapEditor'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
      <p className="text-gray-600">Loading map...</p>
    </div>
  )
});

function Hero() {
  return (
    <section className="relative py-20 lg:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-orange-50" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <Zap className="w-16 h-16 text-orange-500" />
          </div>

          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-gray-900">
            On Demand Weather Forecasts
            <span className="block text-orange-500">That Actually Reach You</span>
          </h1>

          <p className="text-lg text-gray-600 max-w-xl mx-auto mb-8">
            Regular SMS now works with your land cell number when you are out of cell range through satellite*
          </p>

          {/* Device SMS Previews */}
          <div className="flex flex-col md:flex-row justify-center items-center md:items-center gap-6 md:gap-4 mb-8">
            {/* iPhone */}
            <div className="flex flex-col items-center">
              <div className="w-[280px] h-[560px] bg-black rounded-[36px] p-[12px] shadow-2xl relative">
                {/* iPhone notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[100px] h-[22px] bg-black rounded-b-[12px] z-10"></div>
                {/* Screen */}
                <div className="w-full h-full bg-white rounded-[26px] overflow-hidden flex flex-col">
                  {/* Header */}
                  <div className="bg-[#f6f6f6] pt-[38px] pb-[8px] px-[12px] text-center border-b border-[#ddd]">
                    <span className="text-black text-[15px] font-semibold">Thunderbird</span>
                  </div>
                  {/* Messages area with auto-scroll */}
                  <div className="flex-1 p-[12px] overflow-hidden">
                    <div className="bg-[#e5e5ea] text-black p-[8px_12px] rounded-[16px] rounded-bl-[4px] max-w-[90%] text-[13px] leading-[1.4] whitespace-pre-wrap animate-scroll-up">
{`LAKEO Lake Oberon (863m)
24hr from 06:00 Mon

06h 5-7o Rn15% W12-20 Cld40% CB18 FL22

08h 7-10o Rn18% W14-22 Cld45% CB17 FL21

10h 10-14o Rn22% 0-1mm W16-26 Cld52% CB15 FL19

12h 12-16o Rn25% 1-3mm W18-30 Cld60% CB14 FL18 !

14h 14-18o Rn30% 2-5mm W22-35 Cld70% CB12 FL16 !

16h 12-16o Rn25% 1-2mm W20-32 Cld65% CB13 FL17 !

18h 10-14o Rn20% 0-1mm W18-28 Cld50% CB14 FL18

20h 8-11o Rn15% W15-24 Cld45% CB15 FL19

22h 6-9o Rn12% W12-20 Cld40% CB16 FL20

00h 4-6o Rn10% W10-18 Cld35% CB18 FL22

Rn=Rain W=Wind Cld=Cloud
CB=CloudBase(x100m)
FL=Freeze(x100m)`}
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-gray-500 text-sm mt-3">iPhone</p>
            </div>

            {/* Apple Watch Ultra */}
            <div className="flex flex-col items-center">
              <div className="w-[180px] h-[220px] bg-[#1a1a1a] rounded-[44px] p-[8px] shadow-2xl relative border-[3px] border-[#2a2a2a]">
                {/* Digital Crown */}
                <div className="absolute right-[-6px] top-[60px] w-[6px] h-[28px] bg-[#ff6b00] rounded-r-[3px]"></div>
                {/* Side button */}
                <div className="absolute right-[-5px] top-[100px] w-[5px] h-[18px] bg-[#333] rounded-r-[2px]"></div>
                {/* Screen */}
                <div className="w-full h-full bg-black rounded-[38px] overflow-hidden flex flex-col">
                  {/* Messages area with auto-scroll */}
                  <div className="flex-1 p-[10px] overflow-hidden">
                    <div className="text-white text-[9px] leading-[1.3] whitespace-pre-wrap animate-scroll-up-watch">
{`LAKEO 863m
Mon 20 Jan

06h 5-7o Rn15%
W12-20 CB18 FL22

08h 7-10o Rn18%
W14-22 CB17 FL21

10h 10-14o Rn22%
W16-26 CB15 FL19

12h 12-16o Rn25% !
W18-30 CB14 FL18

14h 14-18o Rn30% !
W22-35 CB12 FL16

16h 12-16o Rn25%
W20-32 CB13 FL17

18h 10-14o Rn20%
W18-28 CB14 FL18

Rn=Rain W=Wind
CB=Cloud FL=Freeze`}
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-gray-500 text-sm mt-3">Apple Watch Ultra</p>
            </div>
          </div>

          <div className="flex justify-center mb-8">
            <Link href="/checkout" className="btn-orange text-lg px-16 py-4">
              Buy Now
            </Link>
          </div>

          <p className="text-lg text-gray-700 max-w-xl mx-auto mb-4">
            Use your regular phone or satellite enabled SMS watch whilst out on trail to receive the latest weather forecast for your selected weather zones.
          </p>

          <p className="text-lg text-gray-700 max-w-xl mx-auto mb-8">
            When data isn&apos;t available, your forecast still arrives.
          </p>

          {/* How It Works */}
          <div className="mt-12 mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="card p-6 text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Navigation className="w-8 h-8 text-orange-500" />
                </div>
                <div className="text-orange-500 font-bold text-sm mb-2">Step 1</div>
                <h3 className="font-semibold text-lg mb-2">Set Waypoints</h3>
                <p className="text-gray-500 text-sm">Mark your camps and key locations along the trail with elevations.</p>
              </div>
              <div className="card p-6 text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Save className="w-8 h-8 text-orange-500" />
                </div>
                <div className="text-orange-500 font-bold text-sm mb-2">Step 2</div>
                <h3 className="font-semibold text-lg mb-2">Save Route</h3>
                <p className="text-gray-500 text-sm">Save your route with forecast zones for each waypoint.</p>
              </div>
              <div className="card p-6 text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-8 h-8 text-orange-500" />
                </div>
                <div className="text-orange-500 font-bold text-sm mb-2">Step 3</div>
                <h3 className="font-semibold text-lg mb-2">Pull Forecast via Satellite SMS</h3>
                <p className="text-gray-500 text-sm">Request your forecast on trail and receive it via satellite SMS.</p>
              </div>
            </div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto text-center mt-8 mb-6">
              Use one of our pre loaded popular trail templates or upload your own GPX file and create your own
            </p>
            <div className="flex justify-center">
              <Link href="/checkout" className="btn-orange text-lg px-16 py-4">
                Buy Now
              </Link>
            </div>
          </div>

          <p className="text-gray-400 text-xs max-w-2xl mx-auto text-center mt-8">
            *Available on any satellite SMS compatible Apple phone or watch and where your terrestrial plan provider has a partnership with a satellite provider, which is becoming increasingly more common.
          </p>
        </div>
      </div>
    </section>
  )
}

// Overland Track waypoints from spec
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
      [145.9614, -41.6504],
      [145.9525, -41.6607],
      [145.9469, -41.7147],
      [145.9498, -41.7641],
      [146.0100, -41.8000],
      [146.0464, -41.8295],
      [146.0820, -41.8921],
      [146.0889, -41.9321],
      [146.1200, -41.9600],
      [146.1667, -41.9958],
    ]
  }
};

const TYPE_COLORS = {
  camp: '#22c55e',
  peak: '#f97316',
  poi: '#3b82f6'
};

function RouteExample() {
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(null);
  const selectedWaypoint = allOverlandWaypoints.find(w => w.id === selectedWaypointId);

  return (
    <section id="route-example" className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Overland Track Example
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            See how Thunderbird maps your route with camps, peaks, and weather zones. Click any waypoint to see its SMS code.
          </p>
        </div>

        {/* Map */}
        <div className="card p-4 mb-6">
          <MapEditor
            trackGeojson={overlandTrackGeojson}
            waypoints={allOverlandWaypoints}
            selectedWaypointId={selectedWaypointId}
            onWaypointSelect={setSelectedWaypointId}
            initialViewport={{
              latitude: -41.82,
              longitude: 146.0,
              zoom: 9
            }}
          />

          {/* Legend */}
          <div className="mt-4 flex flex-wrap justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: TYPE_COLORS.camp }} />
              <span className="text-gray-700">Camps ({overlandCamps.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: TYPE_COLORS.peak }} />
              <span className="text-gray-700">Peaks ({overlandPeaks.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: TYPE_COLORS.poi }} />
              <span className="text-gray-700">POI ({overlandPois.length})</span>
            </div>
          </div>
        </div>

        {/* Selected Waypoint Detail */}
        {selectedWaypoint && (
          <div className="card p-4 mb-6 border-2 border-orange-500">
            <div className="flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: TYPE_COLORS[selectedWaypoint.type] }}
              >
                {selectedWaypoint.smsCode.slice(0, 3)}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{selectedWaypoint.name}</h3>
                <p className="text-gray-600 text-sm">
                  Text <code className="bg-gray-100 px-2 py-0.5 rounded font-mono text-orange-600">{selectedWaypoint.smsCode}</code> for weather
                  <span className="text-gray-400 ml-2">• {selectedWaypoint.elevation}m</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Waypoint Lists - Compact */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {/* Camps */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Tent className="w-4 h-4 text-green-500" />
              <h3 className="font-semibold">Camps</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {overlandCamps.map((camp) => (
                <button
                  key={camp.id}
                  onClick={() => setSelectedWaypointId(camp.id)}
                  className={`flex items-center gap-2 p-2 rounded text-left transition-colors ${
                    selectedWaypointId === camp.id ? 'bg-green-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <code className="text-green-600 font-mono text-xs">{camp.smsCode}</code>
                  <span className="text-gray-600 truncate">{camp.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Peaks */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Mountain className="w-4 h-4 text-orange-500" />
              <h3 className="font-semibold">Peaks</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {overlandPeaks.map((peak) => (
                <button
                  key={peak.id}
                  onClick={() => setSelectedWaypointId(peak.id)}
                  className={`flex items-center gap-2 p-2 rounded text-left transition-colors ${
                    selectedWaypointId === peak.id ? 'bg-orange-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <code className="text-orange-600 font-mono text-xs">{peak.smsCode}</code>
                  <span className="text-gray-600 truncate">{peak.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <Link href="/checkout" className="btn-orange text-lg px-16 py-4">
            Buy Now
          </Link>
        </div>
      </div>
    </section>
  )
}

function Features() {
  const features = [
    {
      icon: Clock,
      title: 'Hour-by-Hour',
      description: '2-hour intervals throughout the day. Know exactly when conditions change.',
      code: '06h'
    },
    {
      icon: Thermometer,
      title: 'Temperature Range',
      description: 'Min-max temperature adjusted for elevation using 6.5°C/1000m lapse rate.',
      code: '5-7o'
    },
    {
      icon: Droplets,
      icon2: Snowflake,
      title: 'Precipitation',
      description: 'Rain or snow probability plus expected accumulation. Snow shown when freezing level is below elevation.',
      code: 'Rn25% 1-3mm / Sn0cm'
    },
    {
      icon: Wind,
      title: 'Wind Speed',
      description: 'Sustained and gust speeds in km/h. Critical for exposed ridgelines.',
      code: 'W18-30'
    },
    {
      icon: Cloud,
      title: 'Cloud Cover',
      description: 'Percentage of sky covered. Plan your photography and navigation.',
      code: 'Cld60%'
    },
    {
      icon: Mountain,
      title: 'Cloud Base',
      description: 'Height where clouds begin (×100m). Know if you\'ll be hiking in cloud.',
      code: 'CB14'
    },
    {
      icon: Snowflake,
      title: 'Freezing Level',
      description: 'Altitude where temperature hits 0°C (×100m). Essential for snow/ice.',
      code: 'FL18'
    },
    {
      icon: AlertTriangle,
      title: 'Danger Indicator',
      description: 'Warning flag for hazardous conditions: high wind, ice risk, poor visibility.',
      code: '!'
    }
  ]

  return (
    <section id="forecast-features" className="py-20 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            What&apos;s in the Forecast
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-2">
            Every metric you need, in order of appearance
          </p>
          <p className="text-gray-500 max-w-2xl mx-auto">
            We use weather APIs with the greatest resolution to make sure you get accurate hourly forecasts.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <div key={i} className="card p-6">
              <div className="flex gap-2 mb-4">
                <feature.icon className="w-10 h-10 text-orange-500" />
                {feature.icon2 && <feature.icon2 className="w-10 h-10 text-orange-500" />}
              </div>
              <span className="text-orange-500 font-bold font-mono text-sm">{feature.code}</span>
              <h3 className="font-semibold text-lg mb-2 mt-1">{feature.title}</h3>
              <p className="text-gray-500 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-center mt-12">
          <Link href="/checkout" className="btn-orange text-lg px-16 py-4">
            Buy Now
          </Link>
        </div>
      </div>
    </section>
  )
}

function CostComparison() {
  return (
    <section id="cost-comparison" className="py-20 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Cost Comparison
          </h2>
          <p className="text-xl text-gray-600">
            No device to buy. No subscription to maintain.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Thunderbird */}
          <div className="card p-6 border-orange-500 border-2 flex flex-col">
            <div className="text-center mb-6">
              <Zap className="w-10 h-10 text-orange-500 mx-auto mb-2" />
              <h3 className="text-xl font-bold text-orange-500">Thunderbird</h3>
            </div>
            <div className="space-y-4 flex-grow">
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-500">Device Cost</span>
                <span className="font-semibold text-orange-500">$0.00</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-500">Monthly Cost</span>
                <span className="font-semibold text-orange-500">$0.00</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-500">1st Month (min)</span>
                <span className="font-semibold text-orange-500">$29.99</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-500">12 Month (min)</span>
                <span className="font-semibold text-orange-500">$29.99</span>
              </div>
              <div className="pt-2">
                <span className="text-gray-500 text-sm block mb-1">Cost per Forecast*</span>
                <span className="font-semibold text-orange-500">$0.07 - $0.87</span>
                <div className="text-gray-400 text-xs mt-2">
                  US $0.07 | AU, GB ~$0.42<br />
                  CH, FR ~$0.60 | IT, NZ, ZA ~$0.80
                </div>
              </div>
            </div>
            <Link href="/checkout" className="btn-orange w-full text-center text-lg py-4 mt-6 block">
              Buy Now
            </Link>
          </div>

          {/* Garmin */}
          <div className="card p-6 flex flex-col">
            <div className="text-center mb-6">
              <Satellite className="w-10 h-10 text-gray-500 mx-auto mb-2" />
              <h3 className="text-xl font-bold">Garmin inReach Mini 2</h3>
            </div>
            <div className="space-y-4 flex-grow">
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-500">Device Cost</span>
                <span className="font-semibold">$399.00</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-500">Monthly Cost</span>
                <span className="font-semibold">$14.95 - $64.95</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-500">1st Month (min)</span>
                <span className="font-semibold">$413.95</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-500">12 Month (min)</span>
                <span className="font-semibold">$578.40</span>
              </div>
              <div className="pt-2">
                <span className="text-gray-500 text-sm block mb-1">Cost per Forecast**</span>
                <span className="font-semibold">$1.00 - $2.00</span>
                <div className="text-gray-400 text-xs mt-2">
                  On top of monthly subscription
                </div>
              </div>
            </div>
            <div className="btn-secondary w-full text-center text-lg py-4 mt-6 opacity-50 cursor-not-allowed">
              External Provider
            </div>
          </div>

          {/* Zoleo */}
          <div className="card p-6 flex flex-col">
            <div className="text-center mb-6">
              <MessageSquare className="w-10 h-10 text-gray-500 mx-auto mb-2" />
              <h3 className="text-xl font-bold">Zoleo</h3>
            </div>
            <div className="space-y-4 flex-grow">
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-500">Device Cost</span>
                <span className="font-semibold">$199.00</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-500">Monthly Cost</span>
                <span className="font-semibold">$20.00 - $50.00</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-500">1st Month (min)</span>
                <span className="font-semibold">$219.00</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-500">12 Month (min)</span>
                <span className="font-semibold">$439.00</span>
              </div>
              <div className="pt-2">
                <span className="text-gray-500 text-sm block mb-1">Cost per Forecast**</span>
                <span className="font-semibold">$0.14 - $0.80</span>
                <div className="text-gray-400 text-xs mt-2">
                  Uses message credits from plan
                </div>
              </div>
            </div>
            <div className="btn-secondary w-full text-center text-lg py-4 mt-6 opacity-50 cursor-not-allowed">
              External Provider
            </div>
          </div>
        </div>

        <div className="text-gray-400 text-xs text-center space-y-1">
          <p>All prices in USD. * Based on 4 SMS segments per forecast via satellite SMS.</p>
          <p>** Requires active monthly subscription to use device.</p>
        </div>
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section id="pricing" className="py-20 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <Zap className="w-12 h-12 text-orange-500 mx-auto mb-6" />
        <h2 className="text-3xl md:text-4xl font-bold mb-6">
          Beta Launching January 2026
        </h2>

        <div className="card p-8 max-w-md mx-auto mb-8">
          <div className="flex items-baseline justify-center gap-1 mb-2">
            <span className="text-5xl font-bold">$29.99</span>
            <span className="text-gray-500">USD</span>
          </div>
          <p className="text-gray-600 mb-4">
            Includes $10 SMS credits
          </p>
          <p className="text-gray-500 text-sm">
            About a week on trail with full weather forecast coverage
          </p>
        </div>

        <Link href="/checkout" className="btn-orange text-lg px-16 py-4">
          Buy Now
        </Link>

        <p className="text-gray-400 text-sm mt-6">
          Works with iPhone 14+ satellite SMS and compatible devices.
        </p>
      </div>
    </section>
  )
}

// FAQ data for both display and schema
const faqData = [
  {
    question: "How does Thunderbird deliver weather forecasts via satellite?",
    answer: "Thunderbird uses your phone's satellite SMS capability (available on iPhone 14 and newer, Apple Watch Ultra, and other satellite-enabled devices). Simply text your waypoint code to our service number, and you'll receive a detailed weather forecast via satellite SMS - no cellular coverage or internet required. This works anywhere in the world with satellite visibility."
  },
  {
    question: "What weather data is included in each forecast?",
    answer: "Each forecast includes hour-by-hour data for temperature range (adjusted for elevation), rain/snow probability and accumulation, wind speed (sustained and gusts), cloud cover percentage, cloud base height, freezing level, and danger indicators for hazardous conditions. All data comes from Bureau of Meteorology's high-resolution 3km grid system."
  },
  {
    question: "How accurate are the elevation-adjusted forecasts?",
    answer: "Thunderbird uses the standard atmospheric lapse rate of 6.5°C per 1000m to adjust temperature forecasts for your exact elevation. Combined with BOM's 3km resolution data, this provides significantly more accurate forecasts than generic mountain weather services. Freezing level and cloud base heights help you know exactly what conditions to expect at your camp or summit."
  },
  {
    question: "Do I need a separate satellite device or subscription?",
    answer: "No separate device is needed if you have a satellite SMS capable phone (iPhone 14+) or watch (Apple Watch Ultra). You use your existing device and carrier's satellite SMS feature. Thunderbird charges only for the forecasts you request - there's no monthly subscription or additional hardware to purchase."
  },
  {
    question: "How much does each forecast cost?",
    answer: "Each forecast costs approximately $0.07 to $0.87 USD depending on your country's satellite SMS rates. The $29.99 starter pack includes $10 in SMS credits, which covers approximately 140 forecasts - enough for multiple week-long trips. Credits never expire, and there are no monthly fees."
  },
  {
    question: "Can I create custom routes or only use preset trails?",
    answer: "Both! Thunderbird offers popular trail templates like the Overland Track and Western Arthurs, or you can upload your own GPX file and create completely custom routes. Add waypoints for camps, peaks, and points of interest, and each location gets its own SMS code for on-demand forecasts."
  },
  {
    question: "What areas does Thunderbird cover?",
    answer: "Thunderbird currently covers Tasmania, Australia using Bureau of Meteorology data. Coverage is expanding to include mainland Australia alpine regions, New Zealand, and other remote hiking destinations. The satellite SMS delivery works globally wherever your device has satellite visibility."
  },
  {
    question: "How do I request a forecast while on trail?",
    answer: "Simply send an SMS with your waypoint code (like 'PELIO' for New Pelion Hut) to the Thunderbird service number. Within minutes, you'll receive a detailed 24-hour forecast for that exact location. No app needed, no internet required - just standard SMS that routes through satellite when out of cell range."
  }
];

function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-gray-600">
            Everything you need to know about Thunderbird
          </p>
        </div>

        <div className="space-y-4">
          {faqData.map((faq, index) => (
            <div
              key={index}
              className="card overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors"
              >
                <span className="font-semibold text-gray-900">{faq.question}</span>
                <span className="text-gray-400 text-2xl flex-shrink-0">
                  {openIndex === index ? '−' : '+'}
                </span>
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  openIndex === index ? 'max-h-96' : 'max-h-0'
                }`}
              >
                <div className="px-6 pb-4 text-gray-600 leading-relaxed">
                  {faq.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* JSON-LD FAQPage Schema for Google AI Overview & LLM optimization */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": faqData.map(faq => ({
              "@type": "Question",
              "name": faq.question,
              "acceptedAnswer": {
                "@type": "Answer",
                "text": faq.answer
              }
            }))
          })
        }}
      />
    </section>
  )
}

export default function Home() {
  return (
    <>
      <Hero />
      <RouteExample />
      <Features />
      <CTA />
      <CostComparison />
      <FAQ />
    </>
  )
}
