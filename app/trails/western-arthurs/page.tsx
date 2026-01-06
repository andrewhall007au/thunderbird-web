import Link from 'next/link'
import { 
  Mountain, MapPin, Calendar, AlertTriangle,
  Thermometer, Wind, Droplets
} from 'lucide-react'

export const metadata = {
  title: 'Western Arthurs - Thunderbird',
  description: 'Weather forecasts for the Western Arthurs traverse in Southwest Tasmania.',
}

const camps = [
  { code: 'JUNCT', name: 'Junction Creek', elevation: 620, day: 1 },
  { code: 'HAVEN', name: 'Haven Lake', elevation: 840, day: 2 },
  { code: 'OBERN', name: 'Lake Oberon', elevation: 920, day: 3 },
  { code: 'LUCKT', name: 'Lake Luckmans', elevation: 850, day: 4 },
  { code: 'PROCY', name: 'Lake Procyon', elevation: 880, day: 5 },
  { code: 'JUNOL', name: 'Juno Lake', elevation: 800, day: 6 },
  { code: 'PROMT', name: 'Promontory Lake', elevation: 760, day: 7 },
  { code: 'SEVEN', name: 'Seven Mile', elevation: 640, day: 8 },
  { code: 'MORAN', name: 'Moraine A', elevation: 720, day: 9 },
  { code: 'CRACR', name: 'Cracroft Crossing', elevation: 320, day: 10 },
]

const peaks = [
  { name: 'West Portal', elevation: 1181 },
  { name: 'Mt Hayes', elevation: 1088 },
  { name: 'Mt Sirius', elevation: 1149 },
  { name: 'Federation Peak', elevation: 1225 },
  { name: 'Pegasus South', elevation: 1050 },
]

export default function WesternArthursPage() {
  return (
    <div className="py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-2 text-thunder-400 text-sm mb-4">
            <Link href="/" className="hover:text-white">Home</Link>
            <span>/</span>
            <span className="text-white">Western Arthurs</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Western Arthurs
          </h1>
          <p className="text-xl text-thunder-300 max-w-3xl">
            A challenging alpine traverse through Tasmania&apos;s remote Southwest wilderness. 
            Expert navigation required, no marked trail.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="card p-4 text-center">
            <Calendar className="w-6 h-6 text-storm-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">10-12</p>
            <p className="text-thunder-400 text-sm">Days</p>
          </div>
          <div className="card p-4 text-center">
            <MapPin className="w-6 h-6 text-storm-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">55</p>
            <p className="text-thunder-400 text-sm">Kilometers</p>
          </div>
          <div className="card p-4 text-center">
            <Mountain className="w-6 h-6 text-storm-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">1225</p>
            <p className="text-thunder-400 text-sm">Highest Peak (m)</p>
          </div>
          <div className="card p-4 text-center">
            <AlertTriangle className="w-6 h-6 text-orange-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">Expert</p>
            <p className="text-thunder-400 text-sm">Difficulty</p>
          </div>
        </div>

        {/* Route variants */}
        <div className="card p-6 mb-12">
          <h2 className="text-xl font-semibold mb-4">Route Variants</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-thunder-800/50 rounded-lg">
              <h3 className="font-semibold text-storm-400">Full Traverse</h3>
              <p className="text-thunder-300 text-sm">10-12 days • Junction Creek to Cracroft Crossing</p>
            </div>
            <div className="p-4 bg-thunder-800/50 rounded-lg">
              <h3 className="font-semibold text-storm-400">A to K</h3>
              <p className="text-thunder-300 text-sm">7-9 days • Exit via Lake Cygnus</p>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="grid lg:grid-cols-3 gap-8 mb-12">
          {/* Camps */}
          <div className="lg:col-span-2">
            <div className="card p-6">
              <h2 className="text-xl font-semibold mb-4">Camps ({camps.length})</h2>
              <div className="space-y-3">
                {camps.map((camp) => (
                  <div key={camp.code} className="flex items-center justify-between py-2 border-b border-thunder-800 last:border-0">
                    <div>
                      <span className="font-mono text-storm-400">{camp.code}</span>
                      <span className="text-thunder-200 ml-2">{camp.name}</span>
                    </div>
                    <div className="text-thunder-400 text-sm">
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
              <h2 className="text-xl font-semibold mb-4">Key Peaks</h2>
              <div className="space-y-3">
                {peaks.map((peak) => (
                  <div key={peak.name} className="flex items-center justify-between py-2 border-b border-thunder-800 last:border-0">
                    <div className="flex items-center gap-2">
                      <Mountain className="w-4 h-4 text-thunder-500" />
                      <span className="text-thunder-200">{peak.name}</span>
                    </div>
                    <span className="text-thunder-400 text-sm">{peak.elevation}m</span>
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
              <Thermometer className="w-5 h-5 text-storm-500 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-sm">Elevation-Adjusted Temps</h3>
                <p className="text-thunder-400 text-sm">Separate forecasts for camp and peak elevations</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Wind className="w-5 h-5 text-storm-500 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-sm">Danger Ratings</h3>
                <p className="text-thunder-400 text-sm">D=0 to D=4 with Ice, Blind, Wind, Precip factors</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Droplets className="w-5 h-5 text-storm-500 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-sm">Snow & Freezing Level</h3>
                <p className="text-thunder-400 text-sm">Know where the snow line is each day</p>
              </div>
            </div>
          </div>
        </div>

        {/* Safety warning */}
        <div className="p-6 bg-orange-500/10 border border-orange-500/30 rounded-xl mb-12">
          <h3 className="font-semibold text-orange-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Important Safety Information
          </h3>
          <ul className="text-thunder-300 space-y-2 text-sm">
            <li>• Expert navigation skills required — no marked trail</li>
            <li>• PLB or satellite communicator essential</li>
            <li>• Allow extra days for weather delays</li>
            <li>• Nearest evacuation: 3-5 days walk</li>
            <li>• Register your trip with Tasmania Parks</li>
          </ul>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link href="/register" className="btn-primary text-lg px-8 py-4">
            Join Waitlist for Western Arthurs
          </Link>
        </div>
      </div>
    </div>
  )
}
