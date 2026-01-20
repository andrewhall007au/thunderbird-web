import Link from 'next/link'
import { 
  Mountain, MapPin, Calendar, AlertTriangle,
  Thermometer, Wind, Droplets
} from 'lucide-react'

export const metadata = {
  title: 'Overland Track - Thunderbird',
  description: 'Weather forecasts for the Overland Track in Cradle Mountain-Lake St Clair National Park.',
}

const camps = [
  { code: 'RONER', name: 'Ronny Creek', elevation: 900, day: 1 },
  { code: 'WATER', name: 'Waterfall Valley Hut', elevation: 920, day: 1 },
  { code: 'WINDE', name: 'Windermere Hut', elevation: 1050, day: 2 },
  { code: 'PELIO', name: 'Pelion Hut', elevation: 860, day: 3 },
  { code: 'KIORA', name: 'Kia Ora Hut', elevation: 720, day: 4 },
  { code: 'NARCR', name: 'Narcissus Hut', elevation: 740, day: 5 },
  { code: 'STCLA', name: 'Lake St Clair', elevation: 737, day: 6 },
]

const peaks = [
  { name: 'Cradle Mountain', elevation: 1545 },
  { name: 'Barn Bluff', elevation: 1559 },
  { name: 'Mt Ossa', elevation: 1617 },
  { name: 'Mt Pelion East', elevation: 1433 },
  { name: 'Mt Oakleigh', elevation: 1286 },
]

export default function OverlandTrackPage() {
  return (
    <div className="py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-4">
            <Link href="/" className="hover:text-gray-900">Home</Link>
            <span>/</span>
            <span className="text-gray-900">Overland Track</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Overland Track
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl">
            Tasmania&apos;s premier alpine walking track through Cradle Mountain-Lake St Clair 
            National Park. One of Australia&apos;s most iconic multi-day hikes.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="card p-4 text-center">
            <Calendar className="w-6 h-6 text-orange-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">6</p>
            <p className="text-gray-500 text-sm">Days</p>
          </div>
          <div className="card p-4 text-center">
            <MapPin className="w-6 h-6 text-orange-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">65</p>
            <p className="text-gray-500 text-sm">Kilometers</p>
          </div>
          <div className="card p-4 text-center">
            <Mountain className="w-6 h-6 text-orange-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">1617</p>
            <p className="text-gray-500 text-sm">Mt Ossa (m)</p>
          </div>
          <div className="card p-4 text-center">
            <AlertTriangle className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">Moderate</p>
            <p className="text-gray-500 text-sm">Difficulty</p>
          </div>
        </div>

        {/* Main content */}
        <div className="grid lg:grid-cols-3 gap-8 mb-12">
          {/* Camps */}
          <div className="lg:col-span-2">
            <div className="card p-6">
              <h2 className="text-xl font-semibold mb-4">Huts & Camps ({camps.length})</h2>
              <div className="space-y-3">
                {camps.map((camp) => (
                  <div key={camp.code} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                    <div>
                      <span className="font-mono text-orange-500">{camp.code}</span>
                      <span className="text-gray-700 ml-2">{camp.name}</span>
                    </div>
                    <div className="text-gray-500 text-sm">
                      {camp.elevation}m • Day {camp.day}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Peaks */}
          <div>
            <div className="card p-6">
              <h2 className="text-xl font-semibold mb-4">Side Trip Peaks</h2>
              <div className="space-y-3">
                {peaks.map((peak) => (
                  <div key={peak.name} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                    <div className="flex items-center gap-2">
                      <Mountain className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-700">{peak.name}</span>
                    </div>
                    <span className="text-gray-500 text-sm">{peak.elevation}m</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* What Thunderbird provides */}
        <div className="card p-6 mb-12">
          <h2 className="text-xl font-semibold mb-4">What Thunderbird Provides</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex gap-3">
              <Thermometer className="w-5 h-5 text-orange-500 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-sm">Peak Forecasts</h3>
                <p className="text-gray-500 text-sm">Summit conditions for Mt Ossa, Cradle, Barn Bluff</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Wind className="w-5 h-5 text-orange-500 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-sm">Danger Ratings</h3>
                <p className="text-gray-500 text-sm">Know which days are safe for side trips</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Droplets className="w-5 h-5 text-orange-500 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-sm">Trail Conditions</h3>
                <p className="text-gray-500 text-sm">Rain, snow, and visibility forecasts</p>
              </div>
            </div>
          </div>
        </div>

        {/* Booking note */}
        <div className="p-6 bg-blue-50 border border-blue-200 rounded-xl mb-12">
          <h3 className="font-semibold text-orange-500 mb-3">Booking Required</h3>
          <p className="text-gray-600 text-sm">
            The Overland Track requires booking during peak season (October to May). 
            Book through the Tasmania Parks website. Thunderbird forecasts complement 
            your parks booking — we don&apos;t replace it.
          </p>
        </div>

        {/* Safety warning */}
        <div className="p-6 bg-orange-500/10 border border-orange-500/30 rounded-xl mb-12">
          <h3 className="font-semibold text-orange-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Weather Considerations
          </h3>
          <ul className="text-gray-600 space-y-2 text-sm">
            <li>• Weather can change rapidly at altitude</li>
            <li>• Snow possible year-round on exposed sections</li>
            <li>• Side trips (Mt Ossa, Cradle) add significant exposure</li>
            <li>• Carry warm clothing regardless of forecast</li>
          </ul>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link href="/checkout" className="btn-orange text-lg px-16 py-4">
            Buy Now
          </Link>
        </div>
      </div>
    </div>
  )
}
