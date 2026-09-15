import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Hide the bottom-left Next.js / Node "N" badge for everyone.
  // Next cannot role-gate this cleanly; production `next start` also has no indicator.
  devIndicators: false,
  // next dev warns/blocks cross-origin /_next/* unless listed — required for Tailscale Funnel + LAN.
  allowedDevOrigins: [
    "corelia.taila5e165.ts.net",
    "corelia.local",
    "corelia",
    "192.168.1.132",
    "192.168.1.222",
    "100.123.9.86",
    "127.0.0.1",
    "localhost",
  ],
};

export default nextConfig;
