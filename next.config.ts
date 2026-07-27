import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/:path*',
        destination: 'https://shycombinator.framer.website/:path*', 
      },
    ];
  },
};

export default nextConfig;