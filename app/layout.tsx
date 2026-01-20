import './globals.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Zap, Menu } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Thunderbird - Alpine Weather Forecasts via Satellite SMS',
  description: 'Professional elevation-specific weather forecasts delivered directly to your satellite device. BOM 3km data for Tasmania\'s remote hiking trails.',
  keywords: 'hiking weather, Tasmania hiking, satellite SMS, alpine forecast, Western Arthurs, Overland Track',
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <div className="relative">
        <Zap className="w-8 h-8 text-orange-500" />
      </div>
      <span className="font-bold text-xl text-gray-900">Thunderbird</span>
    </Link>
  )
}

function Navigation() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Logo />

          <div className="hidden md:flex items-center gap-8">
            <Link href="/how-it-works" className="nav-link">How It Works</Link>
            <Link href="/#route-example" className="nav-link">Route Example</Link>
            <Link href="/#forecast-features" className="nav-link">What&apos;s in the Forecast</Link>
            <Link href="/#pricing" className="nav-link">Pricing</Link>
            <Link href="/#cost-comparison" className="nav-link">Pricing Comparison</Link>
            <Link href="/#faq" className="nav-link">FAQ</Link>
          </div>

          <div className="hidden md:block">
            <Link href="/checkout" className="btn-orange">
              Buy Now
            </Link>
          </div>

          <button className="md:hidden text-gray-900">
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>
    </nav>
  )
}

function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="col-span-1">
            <Logo />
            <p className="text-gray-500 text-sm mt-4">
              Professional alpine weather forecasts delivered via satellite SMS.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-gray-900">Resources</h4>
            <ul className="space-y-2 text-gray-500 text-sm">
              <li><Link href="/how-it-works" className="hover:text-gray-900">How It Works</Link></li>
              <li><Link href="/#route-example" className="hover:text-gray-900">Route Example</Link></li>
              <li><Link href="/#forecast-features" className="hover:text-gray-900">What&apos;s in the Forecast</Link></li>
              <li><Link href="/pricing" className="hover:text-gray-900">Pricing</Link></li>
              <li><Link href="/faq" className="hover:text-gray-900">FAQ</Link></li>
              <li><Link href="/contact" className="hover:text-gray-900">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-gray-900">Legal</h4>
            <ul className="space-y-2 text-gray-500 text-sm">
              <li><Link href="/terms" className="hover:text-gray-900">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-gray-900">Privacy Policy</Link></li>
              <li><Link href="/safety" className="hover:text-gray-900">Safety Disclaimer</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200 text-center text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} Thunderbird. Weather data from Bureau of Meteorology.</p>
        </div>
      </div>
    </footer>
  )
}

// Organization & Service schema for LLM/SEO optimization
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Thunderbird",
  "description": "Professional alpine weather forecasts delivered via satellite SMS for remote hiking trails.",
  "url": "https://thunderbird.app",
  "logo": "https://thunderbird.app/logo.png",
  "sameAs": [],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer service",
    "availableLanguage": "English"
  }
};

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "Thunderbird Weather Forecast Service",
  "description": "On-demand elevation-specific weather forecasts delivered via satellite SMS. Get accurate temperature, precipitation, wind, cloud base, and freezing level data for your exact hiking location - no cellular coverage required.",
  "provider": {
    "@type": "Organization",
    "name": "Thunderbird"
  },
  "serviceType": "Weather Forecast Service",
  "areaServed": {
    "@type": "Country",
    "name": "Australia"
  },
  "offers": {
    "@type": "Offer",
    "price": "29.99",
    "priceCurrency": "USD",
    "description": "Starter Pack with $10 SMS credits (~140 forecasts)",
    "availability": "https://schema.org/PreOrder"
  }
};

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Thunderbird",
  "applicationCategory": "WeatherApplication",
  "operatingSystem": "iOS, watchOS",
  "description": "Satellite SMS weather forecasts for hikers. Create custom routes with waypoints and receive elevation-specific forecasts via satellite when out of cell range.",
  "offers": {
    "@type": "Offer",
    "price": "29.99",
    "priceCurrency": "USD"
  },
  "featureList": [
    "Satellite SMS delivery - no internet required",
    "Elevation-adjusted temperature forecasts",
    "Hour-by-hour precipitation and wind data",
    "Cloud base and freezing level information",
    "Custom route creation with GPX upload",
    "BOM 3km resolution weather data"
  ]
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
        />
      </head>
      <body>
        <Navigation />
        <main className="pt-16 min-h-screen">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
