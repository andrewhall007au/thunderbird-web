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
          <p className="text-xl text-thunder-300">
            One trip, one price. No subscriptions.
          </p>
        </div>

        {/* Pricing Card */}
        <div className="card p-8 border-storm-500/50 max-w-lg mx-auto mb-16">
          <div className="text-center mb-8">
            <div className="inline-block bg-storm-500/20 text-storm-400 text-sm font-medium px-3 py-1 rounded-full mb-4">
              Beta Pricing
            </div>
            <h2 className="text-2xl font-bold mb-2">Per Trip</h2>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-5xl font-bold">$24.99</span>
              <span className="text-thunder-400">AUD</span>
            </div>
            <p className="text-thunder-400 mt-2">+ GST where applicable</p>
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
                <Check className="w-5 h-5 text-storm-500 mt-0.5 flex-shrink-0" />
                <span className="text-thunder-200">{feature}</span>
              </li>
            ))}
          </ul>

          <Link 
            href="/register" 
            className="btn-primary w-full text-center text-lg py-4 block"
          >
            Get Started
          </Link>

          <p className="text-thunder-500 text-sm mt-4 text-center">
            Beta launching January 2026
          </p>
        </div>

        {/* Cost Comparison */}
        <div className="card p-8 mb-16">
          <h3 className="text-xl font-semibold mb-6 text-center">Cost Comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-thunder-400 text-left border-b border-thunder-700">
                  <th className="py-3 pr-4">Service</th>
                  <th className="py-3 pr-4">Device</th>
                  <th className="py-3 pr-4">Monthly</th>
                  <th className="py-3">7-Day Trip</th>
                </tr>
              </thead>
              <tbody className="text-thunder-200">
                <tr className="border-b border-thunder-800">
                  <td className="py-3 pr-4">Garmin inReach</td>
                  <td className="py-3 pr-4">$549</td>
                  <td className="py-3 pr-4">$30-65</td>
                  <td className="py-3 text-thunder-400">$599+</td>
                </tr>
                <tr className="border-b border-thunder-800">
                  <td className="py-3 pr-4">Zoleo</td>
                  <td className="py-3 pr-4">$349</td>
                  <td className="py-3 pr-4">$25-50</td>
                  <td className="py-3 text-thunder-400">$399+</td>
                </tr>
                <tr className="bg-storm-900/30">
                  <td className="py-3 pr-4 font-semibold">Thunderbird</td>
                  <td className="py-3 pr-4 text-storm-400">$0*</td>
                  <td className="py-3 pr-4 text-storm-400">$0</td>
                  <td className="py-3 text-storm-400 font-bold">$19.99</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-thunder-500 text-sm mt-4 text-center">
            *Works with iPhone 14+ satellite SMS, or any device you already own
          </p>
        </div>

        {/* What you get */}
        <div className="grid md:grid-cols-2 gap-8">
          <div className="card p-6">
            <h3 className="font-semibold text-lg mb-4">Western Arthurs (10 days)</h3>
            <ul className="space-y-2 text-thunder-300 text-sm">
              <li>• 20 forecast pushes (AM + PM)</li>
              <li>• ~120 SMS messages total</li>
              <li>• 15 camps, 21 peaks covered</li>
              <li>• 13 weather cells monitored</li>
            </ul>
            <p className="text-storm-400 font-semibold mt-4">
              Cost per day: $2.00
            </p>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-lg mb-4">Overland Track (6 days)</h3>
            <ul className="space-y-2 text-thunder-300 text-sm">
              <li>• 12 forecast pushes (AM + PM)</li>
              <li>• ~72 SMS messages total</li>
              <li>• 7 camps, 5 peaks covered</li>
              <li>• 7 weather cells monitored</li>
            </ul>
            <p className="text-storm-400 font-semibold mt-4">
              Cost per day: $3.33
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
