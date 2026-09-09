import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Hide the bottom-left Next.js / Node "N" badge for everyone.
  // Next cannot role-gate this cleanly; production `next start` also has no indicator.
  devIndicators: false,
};

export default nextConfig;
