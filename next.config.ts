import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // Matches the root URL (yourdomain.com) and secretly loads your Framer landing page
        source: '/',
        destination: 'https://smiling-technology-410249.framer.app/',
      },
      {
        // Safely paths other sub-pages built on Framer (like /pricing or /about) if you add them later
        source: '/:path(about|pricing|contact)',
        destination: 'https://smiling-technology-410249.framer.app/:path',
      },
    ];
  },
};

export default nextConfig;