/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@vla/shared'],
  async rewrites() {
    // In production (Docker), API_URL is the internal service URL (e.g. http://api:3001).
    // In development, falls back to localhost.
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

const withSerwist = require('@serwist/next').default;

module.exports = withSerwist({
  swSrc:  'src/sw/sw.ts',
  swDest: 'public/sw.js',
})(nextConfig);
