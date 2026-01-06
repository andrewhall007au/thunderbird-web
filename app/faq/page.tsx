import Link from 'next/link'

export const metadata = {
  title: 'FAQ - Thunderbird',
  description: 'Frequently asked questions about Thunderbird alpine weather forecasts.',
}

const faqs = [
  {
    q: 'What devices work with Thunderbird?',
    a: 'Any device that can send and receive SMS via satellite: iPhone 14 or later (via Emergency SOS satellite), Garmin inReach (Mini 2, Explorer+, etc.), Zoleo, Spot X, or any satellite communicator with two-way messaging.'
  },
  {
    q: 'Do I need cell service?',
    a: 'No. Thunderbird works entirely via satellite SMS. You\'ll receive forecasts even in the most remote areas with no cell coverage.'
  },
  {
    q: 'How accurate are the forecasts?',
    a: 'We use the Bureau of Meteorology\'s 3km resolution model — the same data used by professional forecasters. Alpine weather is inherently variable, so we provide danger ratings to help you interpret conditions. Forecasts beyond 2-3 days have reduced accuracy.'
  },
  {
    q: 'What\'s included in the danger rating?',
    a: 'Danger ratings from D=0 (safe) to D=4 (extreme) consider four factors: Ice (peak above freezing level), Blind (peak in cloud), Wind (gusts over 40 km/h), and Precip (rain over 10mm). Camps max out at D=2 since you\'re not on exposed terrain.'
  },
  {
    q: 'What if my trip takes longer than expected?',
    a: 'Text "DELAY" to extend your service by one day. This is included — no extra charge. If you finish early, text "DONE" to end the service.'
  },
  {
    q: 'How does SafeCheck work?',
    a: 'Add up to 5 emergency contacts before your trip. When you check in at a camp (by texting the camp code like "OBERN"), your contacts receive an automatic SMS: "[Name] checked in at Lake Oberon (920m) on Day 3 of Western Arthurs."'
  },
  {
    q: 'What happens if there\'s a severe weather warning?',
    a: 'BOM weather warnings are monitored every 15 minutes. If a warning affects your area, you\'ll receive it immediately — not just at the regular 6 AM and 6 PM push times.'
  },
  {
    q: 'Can I use Thunderbird for trails not listed?',
    a: 'We\'re starting with the Western Arthurs and Overland Track, then expanding. Join the waitlist and let us know which trails you\'d like to see — demand helps us prioritize.'
  },
  {
    q: 'What\'s your refund policy?',
    a: 'Full refund if you cancel before your trip start date. 50% refund within the first 2 days on trail. No refund after day 2, as significant service has been delivered.'
  },
  {
    q: 'Why satellite SMS instead of an app?',
    a: 'Apps require data or cell service. In Tasmania\'s remote areas, you often have neither. SMS works on any satellite device, uses minimal battery, and doesn\'t need any app installation or updates.'
  },
]

export default function FAQPage() {
  return (
    <div className="py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-xl text-thunder-300">
            Everything you need to know about Thunderbird
          </p>
        </div>

        <div className="space-y-6">
          {faqs.map((faq, i) => (
            <div key={i} className="card p-6">
              <h3 className="font-semibold text-lg mb-3">{faq.q}</h3>
              <p className="text-thunder-300">{faq.a}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-thunder-400 mb-4">Still have questions?</p>
          <Link href="/contact" className="btn-secondary">
            Contact Us
          </Link>
        </div>
      </div>
    </div>
  )
}
