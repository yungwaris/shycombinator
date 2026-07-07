import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/:path*',
        destination: 'https://smiling-technology-410249.framer.app/:path*', 
      },
    ];
  },
};

export default nextConfig;