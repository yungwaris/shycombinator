import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/:path*',
        destination: 'https://shycomb2.framer.website/:path*', 
      },
    ];
  },
};

export default nextConfig;