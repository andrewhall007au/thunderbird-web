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
        
        <div className="prose prose-invert prose-thunder max-w-none space-y-6 text-thunder-300">
          <h2 className="text-xl font-semibold text-white mt-8">Weather Forecasts Are Predictions</h2>
          <p>
            Weather forecasts are predictions based on computer models and available data. 
            They are not guarantees of actual conditions. Mountain weather is highly 
            variable and can change rapidly. Conditions may differ significantly from 
            forecast, especially in alpine terrain.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">You Must Make Your Own Decisions</h2>
          <p>
            Thunderbird provides information to help you plan. It does not tell you 
            whether it is safe to proceed. Only you can assess:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Your skill level and experience</li>
            <li>Your physical condition</li>
            <li>Your equipment and supplies</li>
            <li>Actual conditions you observe</li>
            <li>Your party&apos;s capabilities</li>
          </ul>

          <h2 className="text-xl font-semibold text-white mt-8">Danger Ratings Are Guides</h2>
          <p>
            Our danger ratings (D=0 to D=4) are calculated from forecast data. They help 
            identify potentially hazardous conditions but cannot account for all risks. 
            A D=0 rating does not mean conditions are safe. A D=4 rating does not mean 
            travel is impossible. Use these ratings as one input among many.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">Message Delivery Is Not Guaranteed</h2>
          <p>
            SMS delivery depends on satellite coverage, device functionality, and network 
            conditions outside our control. Do not rely on Thunderbird as your only source 
            of weather information. Carry appropriate backup plans and equipment.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">Required Safety Equipment</h2>
          <p>
            For remote Tasmanian hikes, you should always carry:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Personal Locator Beacon (PLB) or satellite communicator</li>
            <li>Navigation equipment (map, compass, GPS)</li>
            <li>Emergency shelter and warmth</li>
            <li>First aid kit</li>
            <li>Sufficient food and water</li>
            <li>Weather-appropriate clothing</li>
          </ul>

          <h2 className="text-xl font-semibold text-white mt-8">SafeCheck Is Not Emergency Response</h2>
          <p>
            SafeCheck notifications inform your contacts of your progress. They are not 
            monitored by emergency services. In an emergency, use your PLB or call 000.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">Trip Registration</h2>
          <p>
            Always register your trip with Tasmania Parks and Wildlife Service. 
            Thunderbird does not replace official trip registration.
          </p>

          <div className="p-6 bg-thunder-800 rounded-xl mt-8">
            <p className="font-semibold text-white mb-2">In an emergency:</p>
            <ul className="space-y-2">
              <li>• Activate your PLB</li>
              <li>• Call 000 if you have phone signal</li>
              <li>• Tasmania Police: 131 444</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
