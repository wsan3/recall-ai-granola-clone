import path from "node:path";
import { defineConfig } from "@playwright/test";

const PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${PORT}`;
export const E2E_WEBHOOK_SECRET = `whsec_${Buffer.from("e2e-webhook-signing-key").toString("base64")}`;

const E2E_DB_PATH = path.join(__dirname, "prisma", "e2e.db");

/**
 * Runs the E2E suite as an HTTP client against a real `next dev` server
 * (started fresh for the run below), rather than calling route handlers
 * in-process like the integration suite does. No browser is launched -
 * these tests only use Playwright's `request` fixture.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: E2E_BASE_URL,
  },
  webServer: {
    // Production build+start (its own .next-e2e/ dir, see next.config.ts) so
    // this never collides with an already-running `npm run dev`.
    command: `npm run e2e:setup-db && npx next build && npx next start -p ${PORT}`,
    url: `${E2E_BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      DATABASE_URL: `file:${E2E_DB_PATH}`,
      E2E_TEST: "1",
      RECALL_WORKSPACE_VERIFICATION_SECRET: E2E_WEBHOOK_SECRET,
    },
  },
});
