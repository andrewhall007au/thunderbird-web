'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Tent, Mountain, MapPin, Info } from 'lucide-react';
import { BetaButton } from '../components/beta/BetaButton';

// Dynamic import for map
const MapEditor = dynamic(() => import('../components/map/MapEditor'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] md:h-[600px] bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
      <p className="text-gray-600">Loading map...</p>
    </div>
  )
});

// Overland Track waypoints from spec (Section 11.3)
const camps = [
  { id: '1', name: 'Ronny Creek', smsCode: 'RONNY', lat: -41.6504, lng: 145.9614, elevation: 942, type: 'camp' as const },
  { id: '2', name: 'Waterfall Valley Hut', smsCode: 'WATER', lat: -41.7147, lng: 145.9469, elevation: 1020, type: 'camp' as const },
  { id: '3', name: 'Lake Windermere Hut', smsCode: 'WINDM', lat: -41.7641, lng: 145.9498, elevation: 993, type: 'camp' as const },
  { id: '4', name: 'New Pelion Hut', smsCode: 'PELIO', lat: -41.8295, lng: 146.0464, elevation: 739, type: 'camp' as const },
  { id: '5', name: 'Kia Ora Hut', smsCode: 'KIAOR', lat: -41.8921, lng: 146.0820, elevation: 863, type: 'camp' as const },
  { id: '6', name: 'Bert Nichols Hut', smsCode: 'BERTN', lat: -41.9321, lng: 146.0889, elevation: 1000, type: 'camp' as const },
  { id: '7', name: 'Narcissus Hut', smsCode: 'NARCI', lat: -41.9958, lng: 146.1667, elevation: 752, type: 'camp' as const },
];

const peaks = [
  { id: '8', name: 'Cradle Mountain', smsCode: 'CRADL', lat: -41.6848, lng: 145.9511, elevation: 1545, type: 'peak' as const },
  { id: '9', name: 'Marions Lookout', smsCode: 'MARIO', lat: -41.6607, lng: 145.9525, elevation: 1224, type: 'peak' as const },
  { id: '10', name: 'Barn Bluff', smsCode: 'BARNB', lat: -41.7244, lng: 145.9225, elevation: 1559, type: 'peak' as const },
  { id: '11', name: 'Mt Oakleigh', smsCode: 'OAKLE', lat: -41.7998, lng: 146.0369, elevation: 1286, type: 'peak' as const },
  { id: '12', name: 'Mt Pelion West', smsCode: 'PELOW', lat: -41.8319, lng: 145.9793, elevation: 1560, type: 'peak' as const },
  { id: '13', name: 'Mt Pelion East', smsCode: 'PELOE', lat: -41.8574, lng: 146.0675, elevation: 1461, type: 'peak' as const },
  { id: '14', name: 'Mt Ossa', smsCode: 'OSSAM', lat: -41.8713, lng: 146.0333, elevation: 1617, type: 'peak' as const },
  { id: '15', name: 'The Acropolis', smsCode: 'ACROP', lat: -41.9534, lng: 146.0645, elevation: 1471, type: 'peak' as const },
];

// Point of interest near Cradle Mountain
const pois = [
  { id: '16', name: 'Kitchen Hut', smsCode: 'KITCH', lat: -41.6866, lng: 145.9481, elevation: 1200, type: 'poi' as const },
];

const allWaypoints = [...camps, ...peaks, ...pois];

// Example track GeoJSON (simplified Overland Track path)
const trackGeojson: GeoJSON.Feature = {
  type: 'Feature',
  properties: { name: 'Overland Track' },
  geometry: {
    type: 'LineString',
    coordinates: [
      [145.9614, -41.6504], // Ronny Creek
      [145.9525, -41.6607], // Marions Lookout
      [145.9469, -41.7147], // Waterfall Valley
      [145.9498, -41.7641], // Windermere
      [146.0100, -41.8000], // Mid track
      [146.0464, -41.8295], // New Pelion
      [146.0820, -41.8921], // Kia Ora
      [146.0889, -41.9321], // Bert Nichols
      [146.1200, -41.9600], // Mid track
      [146.1667, -41.9958], // Narcissus
    ]
  }
};

// BOM Grid cells for the route (approximate 0.02° lat × 0.03° lon)
const bomCells = [
  { id: 'BOM-126-107', lat: -41.64, lng: 145.96, label: '126-107' },
  { id: 'BOM-129-106', lat: -41.70, lng: 145.93, label: '129-106' },
  { id: 'BOM-132-106', lat: -41.76, lng: 145.93, label: '132-106' },
  { id: 'BOM-135-109', lat: -41.82, lng: 146.02, label: '135-109' },
  { id: 'BOM-138-111', lat: -41.88, lng: 146.08, label: '138-111' },
  { id: 'BOM-141-111', lat: -41.94, lng: 146.08, label: '141-111' },
  { id: 'BOM-144-114', lat: -42.00, lng: 146.17, label: '144-114' },
];

const TYPE_COLORS = {
  camp: '#22c55e',
  peak: '#f97316',
  poi: '#3b82f6'
};

const TYPE_ICONS = {
  camp: Tent,
  peak: Mountain,
  poi: MapPin
};

export default function RouteExamplePage() {
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(null);
  const selectedWaypoint = allWaypoints.find(w => w.id === selectedWaypointId);

  return (
    <div className="py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-4">
            <Link href="/" className="hover:text-gray-900">Home</Link>
            <span>/</span>
            <span className="text-gray-900">Route Example</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Overland Track Example
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl">
            See how Thunderbird works with a real route. This example shows all camps,
            peaks, and weather cells for Tasmania&apos;s iconic 65km trek.
          </p>
        </div>

        {/* Map Section */}
        <div className="card p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Interactive Map</h2>
          <p className="text-gray-600 mb-4">
            Click any waypoint to see its details. This is exactly what you&apos;ll create in the route builder.
          </p>

          <MapEditor
            trackGeojson={trackGeojson}
            waypoints={allWaypoints}
            selectedWaypointId={selectedWaypointId}
            onWaypointSelect={setSelectedWaypointId}
            initialViewport={{
              latitude: -41.82,
              longitude: 146.0,
              zoom: 9.5
            }}
          />

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: TYPE_COLORS.camp }} />
              <span className="text-gray-700">Camps ({camps.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: TYPE_COLORS.peak }} />
              <span className="text-gray-700">Peaks ({peaks.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: TYPE_COLORS.poi }} />
              <span className="text-gray-700">Points of Interest ({pois.length})</span>
            </div>
          </div>
        </div>

        {/* Selected Waypoint Detail */}
        {selectedWaypoint && (
          <div className="card p-6 mb-8 border-2 border-orange-500">
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: TYPE_COLORS[selectedWaypoint.type] }}
              >
                {selectedWaypoint.smsCode.slice(0, 3)}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold">{selectedWaypoint.name}</h3>
                <p className="text-gray-600">
                  SMS Code: <code className="bg-gray-100 px-2 py-1 rounded font-mono text-orange-600">{selectedWaypoint.smsCode}</code>
                </p>
                <p className="text-gray-500 text-sm mt-1">
                  {selectedWaypoint.elevation}m elevation &bull; {selectedWaypoint.lat.toFixed(4)}, {selectedWaypoint.lng.toFixed(4)}
                </p>
              </div>
            </div>

            {/* Example SMS */}
            <div className="mt-4 p-4 bg-gray-100 rounded-lg font-mono text-sm">
              <p className="text-gray-500 mb-2">Example forecast request:</p>
              <p className="text-gray-900">Text <strong>{selectedWaypoint.smsCode}</strong> to get weather</p>
            </div>
          </div>
        )}

        {/* Waypoint Lists */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Camps */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Tent className="w-5 h-5 text-green-500" />
              <h2 className="text-xl font-semibold">Camps ({camps.length})</h2>
            </div>
            <div className="space-y-2">
              {camps.map((camp) => (
                <button
                  key={camp.id}
                  onClick={() => setSelectedWaypointId(camp.id)}
                  className={`w-full flex items-center justify-between py-2 px-3 rounded-lg text-left transition-colors ${
                    selectedWaypointId === camp.id
                      ? 'bg-green-50 border border-green-200'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <code className="text-green-600 font-mono font-medium">{camp.smsCode}</code>
                    <span className="text-gray-700">{camp.name}</span>
                  </div>
                  <span className="text-gray-500 text-sm">{camp.elevation}m</span>
                </button>
              ))}
            </div>
          </div>

          {/* Peaks */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Mountain className="w-5 h-5 text-orange-500" />
              <h2 className="text-xl font-semibold">Peaks ({peaks.length})</h2>
            </div>
            <div className="space-y-2">
              {peaks.map((peak) => (
                <button
                  key={peak.id}
                  onClick={() => setSelectedWaypointId(peak.id)}
                  className={`w-full flex items-center justify-between py-2 px-3 rounded-lg text-left transition-colors ${
                    selectedWaypointId === peak.id
                      ? 'bg-orange-50 border border-orange-200'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <code className="text-orange-600 font-mono font-medium">{peak.smsCode}</code>
                    <span className="text-gray-700">{peak.name}</span>
                  </div>
                  <span className="text-gray-500 text-sm">{peak.elevation}m</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* POI Section */}
        <div className="card p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-blue-500" />
            <h2 className="text-xl font-semibold">Points of Interest</h2>
          </div>
          <div className="space-y-2">
            {pois.map((poi) => (
              <button
                key={poi.id}
                onClick={() => setSelectedWaypointId(poi.id)}
                className={`w-full flex items-center justify-between py-2 px-3 rounded-lg text-left transition-colors ${
                  selectedWaypointId === poi.id
                    ? 'bg-blue-50 border border-blue-200'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <code className="text-blue-600 font-mono font-medium">{poi.smsCode}</code>
                  <span className="text-gray-700">{poi.name}</span>
                </div>
                <span className="text-gray-500 text-sm">{poi.elevation}m</span>
              </button>
            ))}
          </div>
        </div>

        {/* BOM Weather Cells Info */}
        <div className="card p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-gray-500" />
            <h2 className="text-xl font-semibold">BOM Weather Cells</h2>
          </div>
          <p className="text-gray-600 mb-4">
            The Bureau of Meteorology divides Tasmania into ~3km grid cells. Each cell receives
            the same base forecast data. Thunderbird adjusts temperature by elevation for accurate
            summit and camp conditions.
          </p>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">
              <strong>Overland Track coverage:</strong> 19 BOM cells
            </p>
            <p className="text-sm text-gray-600">
              <strong>Cell size:</strong> ~2.2km × 2.4km (~5.3 km²)
            </p>
          </div>
        </div>

        {/* Example SMS Preview */}
        <div className="card p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Example SMS Forecast</h2>
          <p className="text-gray-600 mb-4">
            Text any waypoint code to receive a detailed 24-hour forecast:
          </p>
          <div className="sms-preview">
{`PELIO New Pelion Hut (739m)
24hr from 06:00 Mon

06h 5-7° Rn15% W12-20 Cld40% CB18 FL22
08h 7-10° Rn18% W14-22 Cld45% CB17 FL21
10h 10-14° Rn22% W16-26 Cld52% CB15 FL19
12h 12-16° Rn25% W18-30 Cld60% CB14 FL18 !
14h 14-18° Rn30% W22-35 Cld70% CB12 FL16 !
16h 12-16° Rn25% W20-32 Cld65% CB13 FL17

Rn=Rain W=Wind Cld=Cloud
CB=CloudBase FL=Freeze (×100m)`}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            Ready to create your own custom route?
          </p>
          <BetaButton className="btn-orange text-lg px-16 py-4">Apply for Beta</BetaButton>
        </div>
      </div>
    </div>
  );
}
