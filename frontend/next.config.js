/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/backend',
  },
  async rewrites() {
    return [
      {
        source: '/backend/:path*',
        destination: 'https://tenke-proathlete-production.up.railway.app/:path*',
      },
    ]
  },
};

module.exports = nextConfig;
