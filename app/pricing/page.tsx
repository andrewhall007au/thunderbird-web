import Link from 'next/link'
import { Check, Zap } from 'lucide-react'

export const metadata = {
  title: 'Pricing - Thunderbird',
  description: 'Simple, transparent pricing for Thunderbird alpine weather forecasts.',
}

export default function PricingPage() {
  return (
    <div className="py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-600">
            One trip, one price. No subscriptions.
          </p>
        </div>

        {/* Pricing Card */}
        <div className="card p-8 border-orange-500 max-w-lg mx-auto mb-16">
          <div className="text-center mb-8">
            <div className="inline-block bg-orange-100 text-orange-500 text-sm font-medium px-3 py-1 rounded-full mb-4">
              Intro Pricing
            </div>
            <h2 className="text-2xl font-bold mb-2">Get Started</h2>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-5xl font-bold">USD $29.99</span>
            </div>
            <p className="text-orange-500 mt-2 font-medium">Includes USD $10 SMS credits</p>
            <p className="text-gray-500 mt-1 text-sm">About a week on trail with full weather forecast coverage</p>
          </div>

          <ul className="space-y-4 mb-8">
            {[
              'Full trip coverage (up to 14 days)',
              '2x daily forecast push (6 AM & 6 PM)',
              'Elevation-specific camp & peak forecasts',
              'Freezing level & cloud base data',
              'Danger ratings with factors (Ice, Wind, etc.)',
              'Civil twilight times',
              'Real-time BOM weather warnings',
              'SafeCheck alerts to 5 contacts',
              'CAST command for on-demand 12hr forecasts',
              'DELAY and EXTEND trip commands',
            ].map((feature, i) => (
              <li key={i} className="flex items-start gap-3">
                <Check className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{feature}</span>
              </li>
            ))}
          </ul>

          <Link
            href="/checkout"
            className="btn-orange w-full text-center text-lg py-4 block"
          >
            Buy Now
          </Link>

          <p className="text-gray-400 text-sm mt-4 text-center">
            Beta launching January 2026
          </p>
        </div>

        {/* Cost Comparison */}
        <div className="card p-8 mb-16">
          <h3 className="text-xl font-semibold mb-6 text-center">Cost Comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-left border-b border-gray-200">
                  <th className="py-3 pr-4">Service</th>
                  <th className="py-3 pr-4">Device</th>
                  <th className="py-3 pr-4">Monthly</th>
                  <th className="py-3">7-Day Trip</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                <tr className="border-b border-gray-200">
                  <td className="py-3 pr-4">Garmin inReach</td>
                  <td className="py-3 pr-4">USD $549</td>
                  <td className="py-3 pr-4">USD $30-65</td>
                  <td className="py-3 text-gray-500">USD $599+</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-3 pr-4">Zoleo</td>
                  <td className="py-3 pr-4">USD $349</td>
                  <td className="py-3 pr-4">USD $25-50</td>
                  <td className="py-3 text-gray-500">USD $399+</td>
                </tr>
                <tr className="bg-orange-50">
                  <td className="py-3 pr-4 font-semibold">Thunderbird</td>
                  <td className="py-3 pr-4 text-orange-500">USD $0*</td>
                  <td className="py-3 pr-4 text-orange-500">USD $0</td>
                  <td className="py-3 text-orange-500 font-bold">USD $29.99</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-gray-400 text-sm mt-4 text-center">
            *Works with iPhone 14+ satellite SMS, or any device you already own
          </p>
        </div>

      </div>
    </div>
  )
}
