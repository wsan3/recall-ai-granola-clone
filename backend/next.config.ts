import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Backend is reached through a public ngrok tunnel in dev (Recall's
  // webhooks need a public URL); allow that origin for dev-only assets.
  allowedDevOrigins: process.env.PUBLIC_API_BASE_URL
    ? [new URL(process.env.PUBLIC_API_BASE_URL).hostname]
    : [],
  // Playwright E2E builds/starts a second server against a separate SQLite
  // file (see playwright.config.ts) - give it its own build output dir too,
  // so it never touches .next/ while a real `npm run dev` is also running.
  distDir: process.env.E2E_TEST === "1" ? ".next-e2e" : ".next",
};

export default nextConfig;
