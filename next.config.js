/** @type {import('next').NextConfig} */

// Environment variable validation
if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_API_URL) {
  console.warn(
    '\n⚠️  WARNING: NEXT_PUBLIC_API_URL is not set in production.\n' +
    'API calls will use relative URLs. Ensure your production setup supports this.\n' +
    'Set NEXT_PUBLIC_API_URL if you need absolute URLs for API calls.\n'
  );
}

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/admin/:path*',
        destination: 'http://localhost:8000/admin/:path*',
      },
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
