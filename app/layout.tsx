import './globals.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Zap } from 'lucide-react'
import { AuthProvider } from '@/app/lib/auth'
import { HeaderAuth } from '@/app/components/HeaderAuth'
import { MobileNav } from '@/app/components/MobileNav'
import GeoBanner from '@/app/components/GeoBanner'

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

function PromoBanner() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <GeoBanner />
    </div>
  )
}

function Navigation() {
  return (
    <nav className="fixed top-8 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Logo />

          <div className="hidden md:flex items-center gap-8">
            <Link href="#how-it-works" className="nav-link">How It Works</Link>
            <Link href="#why-sms" className="nav-link">Why SMS</Link>
            <Link href="#pricing" className="nav-link">Pricing</Link>
            <Link href="#faq" className="nav-link">FAQ</Link>
            <Link href="#about" className="nav-link">About</Link>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <HeaderAuth />
          </div>

          <MobileNav />
        </div>
      </div>
    </nav>
  )
}

function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <Logo />
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 text-gray-500 text-sm">
            <a href="mailto:hello@thunderbird.bot" className="hover:text-gray-900 transition-colors">
              E: hello@thunderbird.bot
            </a>
            <a href="https://www.thunderbird.bot" className="hover:text-gray-900 transition-colors">
              W: www.thunderbird.bot
            </a>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-gray-200 text-center text-gray-500 text-sm">
          <p>&copy; {new Date().getFullYear()} Thunderbird</p>
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
    "@type": "Place",
    "name": "Worldwide"
  },
  "offers": {
    "@type": "Offer",
    "price": "29.99",
    "priceCurrency": "USD",
    "description": "Starter Pack with $10 USD SMS credits — up to 30 days on trail",
    "availability": "https://schema.org/InStock"
  }
};

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Thunderbird",
  "applicationCategory": "WeatherApplication",
  "operatingSystem": "iOS, watchOS, Android",
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
    "International weather data coverage"
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
        <AuthProvider>
          <PromoBanner />
          <Navigation />
          <main className="pt-24 min-h-screen">
            {children}
          </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  )
}
