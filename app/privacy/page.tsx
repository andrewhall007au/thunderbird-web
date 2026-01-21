export const metadata = {
  title: 'Privacy Policy - Thunderbird',
  description: 'Thunderbird privacy policy.',
}

export default function PrivacyPage() {
  return (
    <div className="py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-600">
          <p className="text-gray-500">Last updated: January 2026</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">Information We Collect</h2>
          <p>We collect the following information:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Phone number</strong> — Required for SMS delivery</li>
            <li><strong>Email address</strong> — For account communication and receipts</li>
            <li><strong>Route and waypoint data</strong> — Locations you create for forecasts</li>
            <li><strong>Payment information</strong> — Processed securely by Stripe (we do not store card details)</li>
            <li><strong>Usage data</strong> — Forecast requests, app interactions, and service usage</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">How We Use Your Information</h2>
          <p>Your information is used to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Deliver weather forecasts to your phone via SMS</li>
            <li>Process payments and manage your account balance</li>
            <li>Send transactional emails (receipts, low balance alerts)</li>
            <li>Improve our service through analytics and usage patterns</li>
            <li>Provide customer support</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">Analytics and Tracking</h2>
          <p>
            We use analytics tools to understand how users interact with our website and
            service. This includes page views, feature usage, conversion tracking, and
            A/B testing to improve user experience. Analytics data is aggregated and does
            not identify individual users.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">Affiliate Program</h2>
          <p>
            We operate an affiliate program. When you visit our site through an affiliate
            link, we set a cookie to track the referral. This cookie contains only the
            affiliate code and expires after 7 days. If you make a purchase, the affiliate
            may receive a commission. No personal information is shared with affiliates.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">Data Retention</h2>
          <p>
            Account data (phone number, email, routes, waypoints) is retained for 2 years
            after your last activity, then automatically deleted. Payment records are
            retained as required by law for tax and accounting purposes.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">Third-Party Services</h2>
          <p>We share data with the following third parties:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Twilio</strong> — SMS delivery (receives your phone number)</li>
            <li><strong>Stripe</strong> — Payment processing (handles card details directly)</li>
            <li><strong>Weather data providers</strong> — We send location coordinates to fetch forecasts; no personal information is shared</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">Cookies</h2>
          <p>We use cookies for:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Session management and authentication</li>
            <li>Remembering your preferences</li>
            <li>Analytics and service improvement</li>
            <li>Affiliate tracking (7-day expiry)</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Access your personal data</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Export your data in a portable format</li>
          </ul>
          <p>
            To exercise these rights, contact us at support@thunderbird.app. We will
            respond within 30 days.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">Security</h2>
          <p>
            We use industry-standard security measures including encryption in transit
            (HTTPS) and at rest. Phone numbers and personal data are stored securely
            and never sold or shared for marketing purposes.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">Children&apos;s Privacy</h2>
          <p>
            Thunderbird is not intended for children under 16. We do not knowingly
            collect personal information from children. If you believe we have collected
            data from a child, please contact us immediately.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">Changes to This Policy</h2>
          <p>
            We may update this privacy policy from time to time. Material changes will
            be communicated via email or notice on our website.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">Contact</h2>
          <p>
            Privacy questions can be sent to support@thunderbird.app
          </p>
        </div>
      </div>
    </div>
  )
}
