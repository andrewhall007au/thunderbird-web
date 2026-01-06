export const metadata = {
  title: 'Privacy Policy - Thunderbird',
  description: 'Thunderbird privacy policy.',
}

export default function PrivacyPage() {
  return (
    <div className="py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        
        <div className="prose prose-invert prose-thunder max-w-none space-y-6 text-thunder-300">
          <p className="text-thunder-400">Last updated: January 2026</p>

          <h2 className="text-xl font-semibold text-white mt-8">Information We Collect</h2>
          <p>We collect:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Phone number (required for SMS delivery)</li>
            <li>Trip details (trail, dates, route variant)</li>
            <li>Position updates (when you check in at camps)</li>
            <li>SafeCheck contact phone numbers (if you add them)</li>
            <li>Payment information (processed by Stripe)</li>
          </ul>

          <h2 className="text-xl font-semibold text-white mt-8">How We Use Your Information</h2>
          <p>Your information is used to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Deliver weather forecasts to your device</li>
            <li>Send check-in notifications to your SafeCheck contacts</li>
            <li>Process payments</li>
            <li>Improve our service</li>
          </ul>

          <h2 className="text-xl font-semibold text-white mt-8">Data Retention</h2>
          <p>
            Trip data is retained for 90 days after your trip ends, then deleted. 
            Payment records are retained as required by law.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">Third Parties</h2>
          <p>We share data with:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Twilio (SMS delivery)</li>
            <li>Stripe (payment processing)</li>
            <li>Bureau of Meteorology (weather data source — no personal data shared)</li>
          </ul>

          <h2 className="text-xl font-semibold text-white mt-8">Your Rights</h2>
          <p>
            You can request deletion of your data at any time by emailing 
            hello@thunderbird.bot. We will delete all personal data within 30 days, 
            except where retention is required by law.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">Security</h2>
          <p>
            We use industry-standard security measures to protect your data. 
            Phone numbers are stored securely and never shared for marketing purposes.
          </p>

          <h2 className="text-xl font-semibold text-white mt-8">Contact</h2>
          <p>
            Privacy questions can be sent to hello@thunderbird.bot
          </p>
        </div>
      </div>
    </div>
  )
}
