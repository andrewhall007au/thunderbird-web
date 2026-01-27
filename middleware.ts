import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Check for dev override via query param: ?geo=AU
  const url = new URL(request.url)
  const geoOverride = url.searchParams.get('geo')

  // Get geolocation from Vercel edge (or use override/default)
  const country = geoOverride || request.geo?.country || 'AU' // Default to AU for dev
  const region = request.geo?.region || ''

  // Create response and set geo cookie
  const response = NextResponse.next()
  response.cookies.set('geo-country', country, {
    httpOnly: false, // Allow client-side access
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
  })

  if (region) {
    response.cookies.set('geo-region', region, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
    })
  }

  return response
}

// Run middleware on all pages except static assets
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
}
