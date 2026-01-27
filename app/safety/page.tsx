import { AlertTriangle } from 'lucide-react'

export const metadata = {
  title: 'Safety Disclaimer - Thunderbird',
  description: 'Important safety information for Thunderbird users.',
}

export default function SafetyPage() {
  return (
    <div className="py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 mb-8">
          <AlertTriangle className="w-10 h-10 text-orange-500" />
          <h1 className="text-4xl font-bold">Safety Disclaimer</h1>
        </div>

        <div className="p-6 bg-orange-500/10 border border-orange-500/30 rounded-xl mb-8">
          <p className="text-lg font-semibold text-orange-400">
            Thunderbird is an information service, not a safety guarantee.
            You are solely responsible for your safety decisions.
          </p>
        </div>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-600">
          <h2 className="text-xl font-semibold text-gray-900 mt-8">Weather Forecasts Are Predictions</h2>
          <p>
            Weather forecasts are predictions based on computer models and available data.
            They are not guarantees of actual conditions. Mountain and backcountry weather
            is highly variable and can change rapidly. Conditions may differ significantly
            from forecast, especially in alpine terrain, coastal areas, and regions with
            complex topography.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">You Must Make Your Own Decisions</h2>
          <p>
            Thunderbird provides information to help you plan. It does not tell you
            whether it is safe to proceed. Only you can assess:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Your skill level and experience</li>
            <li>Your physical condition and fitness</li>
            <li>Your equipment, supplies, and preparedness</li>
            <li>Actual conditions you observe on the ground</li>
            <li>Your party&apos;s capabilities and limitations</li>
            <li>Local hazards and terrain challenges</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">Forecasts Are Location-Specific</h2>
          <p>
            Forecasts are generated for the specific coordinates of your waypoints.
            Conditions can vary significantly over short distances, especially with
            changes in elevation. A forecast for a valley floor may not reflect
            conditions at a nearby summit or ridge.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">Message Delivery Is Not Guaranteed</h2>
          <p>
            SMS delivery depends on satellite coverage, device functionality, atmospheric
            conditions, and network availability — all factors outside our control.
            Do not rely on Thunderbird as your only source of weather information.
            Always have backup plans and alternative information sources.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">Essential Safety Equipment</h2>
          <p>
            For remote outdoor activities, you should always carry appropriate
            safety equipment for your environment, which may include:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Emergency communication device (PLB, satellite messenger, or phone with coverage)</li>
            <li>Navigation equipment appropriate to your activity</li>
            <li>Emergency shelter and warmth layers</li>
            <li>First aid kit</li>
            <li>Sufficient food, water, and emergency supplies</li>
            <li>Weather-appropriate clothing for worst-case conditions</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">Know Before You Go</h2>
          <p>
            Before heading into remote areas:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Check multiple weather sources, not just Thunderbird</li>
            <li>Inform someone of your plans and expected return</li>
            <li>Register with local authorities where required or recommended</li>
            <li>Understand the specific hazards of your destination</li>
            <li>Have a clear turn-back plan if conditions deteriorate</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">Thunderbird Is Not Emergency Services</h2>
          <p>
            Thunderbird is a weather information service. We do not monitor your location,
            we cannot dispatch help, and we are not connected to emergency services.
            In an emergency, use your emergency communication device or contact local
            emergency services directly.
          </p>

          <div className="p-6 bg-gray-100 rounded-xl mt-8">
            <p className="font-semibold text-gray-900 mb-2">In an emergency:</p>
            <ul className="space-y-2">
              <li>Activate your PLB or satellite emergency device</li>
              <li>Call local emergency services if you have signal</li>
              <li>Follow your pre-planned emergency procedures</li>
            </ul>
            <p className="text-sm text-gray-500 mt-4">
              Know your local emergency number before you travel (911 in US/Canada,
              112 in EU, 000 in Australia, 999 in UK, 110 in Japan, etc.)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
