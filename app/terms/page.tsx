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
            Thunderbird provides on-demand weather forecast information delivered via SMS,
            including satellite SMS for areas without cellular coverage. Users create custom
            routes with waypoints and request forecasts by texting waypoint codes to our
            service number.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">2. Account and Credits</h2>
          <p>
            The service requires a one-time purchase of $29.99 USD which includes $10 in SMS
            credits. Additional credits can be purchased at any time. Credits do not expire
            and remain available until used. Each forecast request deducts credits based on
            the SMS delivery cost to your country.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">3. User Responsibilities</h2>
          <p>
            You are solely responsible for your safety while outdoors. Weather forecasts
            are predictions based on available data and may not accurately reflect actual
            conditions. You must carry appropriate safety equipment and make your own
            decisions about whether conditions are safe for travel. See our Safety
            Disclaimer for important information.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">4. Service Limitations</h2>
          <p>
            Thunderbird does not guarantee message delivery. Satellite SMS services
            depend on device functionality, satellite coverage, and network conditions
            outside our control. Forecasts may be delayed or unavailable due to weather
            data source outages or maintenance.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">5. Payments and Refunds</h2>
          <p>
            All purchases are final. We do not offer refunds for the initial purchase or
            credit top-ups. If you experience technical issues preventing service use,
            contact us and we will work to resolve the problem.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">6. Acceptable Use</h2>
          <p>
            You agree not to:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Use the service for any unlawful purpose</li>
            <li>Attempt to reverse engineer or interfere with the service</li>
            <li>Share your account credentials with others</li>
            <li>Use automated systems to send excessive forecast requests</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">7. Limitation of Liability</h2>
          <p>
            Thunderbird is provided &ldquo;as is&rdquo; without warranties of any kind, express
            or implied. To the maximum extent permitted by law, we are not liable for any
            damages arising from use of or inability to use the service, including but not
            limited to personal injury, property damage, or loss of life. Weather forecasts
            are informational only and do not constitute safety advice.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">8. Termination</h2>
          <p>
            We may suspend or terminate your access to the service at any time for violation
            of these terms or for any other reason at our discretion. Upon termination, any
            unused credits are forfeited.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">9. Changes to Terms</h2>
          <p>
            We may update these terms at any time. Material changes will be communicated
            via email or notice on our website. Continued use of the service after changes
            constitutes acceptance of the updated terms.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">10. Governing Law</h2>
          <p>
            These terms are governed by applicable law. Any disputes will be resolved
            through binding arbitration or in courts of competent jurisdiction.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">11. Contact</h2>
          <p>
            Questions about these terms can be sent to support@thunderbird.app
          </p>
        </div>
      </div>
    </div>
  )
}
