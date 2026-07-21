import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Backend is reached through a public ngrok tunnel in dev (Recall's
  // webhooks need a public URL); allow that origin for dev-only assets.
  allowedDevOrigins: process.env.PUBLIC_API_BASE_URL
    ? [new URL(process.env.PUBLIC_API_BASE_URL).hostname]
    : [],
};

export default nextConfig;
