/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*', // Proxy para o backend
      },
    ];
  },
  // Outras configurações existentes...
};

module.exports = nextConfig;