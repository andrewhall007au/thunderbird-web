export const metadata = {
  title: 'Terms of Service - Thunderbird',
  description: 'Thunderbird terms of service.',
}

export default function TermsPage() {
  return (
    <div className="py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        
        <div className="prose prose-gray max-w-none space-y-6 text-gray-600">
          <p className="text-gray-500">Last updated: January 2026</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">1. Service Description</h2>
          <p>
            Thunderbird provides weather forecast information via SMS for hikers 
            undertaking multi-day walks in Tasmania. The service includes scheduled 
            forecast deliveries, position tracking, and emergency contact notifications.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">2. User Responsibilities</h2>
          <p>
            You are solely responsible for your safety while hiking. Weather forecasts 
            are predictions based on available data and may not accurately reflect actual 
            conditions. You must carry appropriate safety equipment, including a PLB or 
            satellite communicator, and make your own decisions about whether conditions 
            are safe for travel.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">3. Service Limitations</h2>
          <p>
            Thunderbird does not guarantee message delivery. Satellite SMS services 
            depend on device functionality, satellite coverage, and network conditions 
            outside our control. Forecasts may be delayed or unavailable due to data 
            source outages.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">4. Payment and Refunds</h2>
          <p>
            Payment is required before service activation. Refunds are available as follows:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>100% refund if cancelled before trip start date</li>
            <li>50% refund if cancelled within first 2 days of service</li>
            <li>No refund after day 2 of service</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">5. Limitation of Liability</h2>
          <p>
            Thunderbird is provided &ldquo;as is&rdquo; without warranties of any kind. We are 
            not liable for any damages arising from use of or inability to use the 
            service, including but not limited to personal injury, property damage, 
            or loss of life.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">6. Changes to Terms</h2>
          <p>
            We may update these terms at any time. Continued use of the service after 
            changes constitutes acceptance of the new terms.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">7. Contact</h2>
          <p>
            Questions about these terms can be sent to hello@thunderbird.bot
          </p>
        </div>
      </div>
    </div>
  )
}
