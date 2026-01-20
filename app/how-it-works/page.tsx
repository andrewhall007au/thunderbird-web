import Link from 'next/link'
import { 
  Smartphone, Satellite, MessageSquare, MapPin, 
  Bell, Shield, Zap, ArrowRight 
} from 'lucide-react'

export const metadata = {
  title: 'How It Works - Thunderbird',
  description: 'Learn how Thunderbird delivers alpine weather forecasts via satellite SMS.',
}

export default function HowItWorksPage() {
  return (
    <div className="py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">
            How Thunderbird Works
          </h1>
          <p className="text-xl text-gray-600">
            Professional forecasts, delivered simply
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-12 mb-20">
          <div className="flex gap-6">
            <div className="flex-shrink-0 w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="text-orange-500 font-bold">1</span>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Register Your Trip</h3>
              <p className="text-gray-600">
                Tell us which trail, your start date, and your phone number. 
                We calculate your route and set up weather monitoring for every 
                camp and peak along the way.
              </p>
            </div>
          </div>

          <div className="flex gap-6">
            <div className="flex-shrink-0 w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="text-orange-500 font-bold">2</span>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Receive Forecasts</h3>
              <p className="text-gray-600">
                Starting the evening before your trip, you&apos;ll receive forecasts 
                at 6 AM and 6 PM daily. Messages are optimized for satellite SMS — 
                maximum information, minimum characters.
              </p>
            </div>
          </div>

          <div className="flex gap-6">
            <div className="flex-shrink-0 w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="text-orange-500 font-bold">3</span>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Check In at Camps</h3>
              <p className="text-gray-600">
                Text your camp code (e.g., &ldquo;OBERN&rdquo;) when you arrive. We&apos;ll update 
                your position and notify your SafeCheck contacts. Future forecasts 
                adjust to show what&apos;s ahead of you.
              </p>
            </div>
          </div>

          <div className="flex gap-6">
            <div className="flex-shrink-0 w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="text-orange-500 font-bold">4</span>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Get Alerts</h3>
              <p className="text-gray-600">
                BOM weather warnings are monitored every 15 minutes. If a 
                severe weather warning affects your area, you&apos;ll receive it 
                immediately — not just at the scheduled push times.
              </p>
            </div>
          </div>
        </div>

        {/* What makes it different */}
        <div className="card p-8 mb-16">
          <h2 className="text-2xl font-bold mb-6 text-center">
            What Makes Thunderbird Different
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex gap-4">
              <Shield className="w-6 h-6 text-orange-500 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">BOM 3km Model</h3>
                <p className="text-gray-500 text-sm">
                  Official Bureau of Meteorology data, not aggregated third-party forecasts.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <MapPin className="w-6 h-6 text-orange-500 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Position-Aware</h3>
                <p className="text-gray-500 text-sm">
                  Forecasts adjust based on where you are, not where you started.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <Zap className="w-6 h-6 text-orange-500 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Elevation-Specific</h3>
                <p className="text-gray-500 text-sm">
                  Separate forecasts for camps and peaks using lapse rate adjustments.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <Bell className="w-6 h-6 text-orange-500 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Real-Time Warnings</h3>
                <p className="text-gray-500 text-sm">
                  BOM warnings delivered within 15 minutes, not hours.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Compatible devices */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-6 text-center">
            Compatible Devices
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="card p-6 text-center">
              <Smartphone className="w-10 h-10 text-orange-500 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">iPhone 14+</h3>
              <p className="text-gray-500 text-sm">
                Built-in satellite SMS. No extra device needed.
              </p>
            </div>

            <div className="card p-6 text-center">
              <Satellite className="w-10 h-10 text-orange-500 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Apple Watch Ultra</h3>
              <p className="text-gray-500 text-sm">
                Satellite SMS directly from your wrist.
              </p>
            </div>

            <div className="card p-6 text-center">
              <MessageSquare className="w-10 h-10 text-orange-500 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Compatible Carriers</h3>
              <p className="text-gray-500 text-sm">
                Any phone where your carrier partners with a satellite provider.
              </p>
            </div>
          </div>
        </div>

        {/* SMS Commands */}
        <div className="card p-8 mb-16">
          <h2 className="text-2xl font-bold mb-6">SMS Commands</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-left border-b border-gray-200">
                  <th className="py-3 pr-4">Command</th>
                  <th className="py-3">Description</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                <tr className="border-b border-gray-200">
                  <td className="py-3 pr-4 font-mono text-orange-500">LAKEO</td>
                  <td className="py-3">Check in at Lake Oberon camp</td>
                </tr>
                <tr className="border-b border-gray-200 bg-orange-50">
                  <td className="py-3 pr-4 font-mono text-orange-500">CAST LAKEO</td>
                  <td className="py-3">Get 12-hour hourly forecast for any camp</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-3 pr-4 font-mono text-orange-500">DELAY</td>
                  <td className="py-3">Extend trip by 1 day (weather delay)</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-3 pr-4 font-mono text-orange-500">EXTEND</td>
                  <td className="py-3">Add more days to trip</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-3 pr-4 font-mono text-orange-500">STATUS</td>
                  <td className="py-3">Get your current trip details</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-3 pr-4 font-mono text-orange-500">KEY</td>
                  <td className="py-3">Get forecast column legend</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-3 pr-4 font-mono text-orange-500">RESEND</td>
                  <td className="py-3">Resend last forecast</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-3 pr-4 font-mono text-orange-500">HELP</td>
                  <td className="py-3">Show quick start guide</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-mono text-orange-500">STOP</td>
                  <td className="py-3">End service (permanent)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link href="/checkout" className="btn-orange text-lg px-16 py-4 inline-flex items-center gap-2">
            Buy Now
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </div>
  )
}
