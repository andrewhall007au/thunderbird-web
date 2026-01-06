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
        <Zap className="w-8 h-8 text-lightning-400" />
      </div>
      <span className="font-bold text-xl">Thunderbird</span>
    </Link>
  )
}

function Navigation() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-thunder-950/90 backdrop-blur-md border-b border-thunder-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Logo />

          <div className="hidden md:flex items-center gap-8">
            <Link href="/trails/western-arthurs" className="nav-link">Western Arthurs</Link>
            <Link href="/trails/overland-track" className="nav-link">Overland Track</Link>
            <Link href="/how-it-works" className="nav-link">How It Works</Link>
            <Link href="/pricing" className="nav-link">Pricing</Link>
          </div>

          <div className="hidden md:block">
            <Link href="/register" className="btn-primary">
              Get Started
            </Link>
          </div>

          <button className="md:hidden text-white">
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>
    </nav>
  )
}

function Footer() {
  return (
    <footer className="bg-thunder-950 border-t border-thunder-800 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1">
            <Logo />
            <p className="text-thunder-400 text-sm mt-4">
              Professional alpine weather forecasts delivered via satellite SMS.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Trails</h4>
            <ul className="space-y-2 text-thunder-400 text-sm">
              <li><Link href="/trails/western-arthurs" className="hover:text-white">Western Arthurs</Link></li>
              <li><Link href="/trails/overland-track" className="hover:text-white">Overland Track</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Resources</h4>
            <ul className="space-y-2 text-thunder-400 text-sm">
              <li><Link href="/how-it-works" className="hover:text-white">How It Works</Link></li>
              <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
              <li><Link href="/faq" className="hover:text-white">FAQ</Link></li>
              <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-thunder-400 text-sm">
              <li><Link href="/terms" className="hover:text-white">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
              <li><Link href="/safety" className="hover:text-white">Safety Disclaimer</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-thunder-800 text-center text-thunder-500 text-sm">
          <p>© {new Date().getFullYear()} Thunderbird. Weather data from Bureau of Meteorology.</p>
        </div>
      </div>
    </footer>
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
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
