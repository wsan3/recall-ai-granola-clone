import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(BACKEND_ROOT, "prisma", "e2e.db");

// Starts every E2E run from a clean SQLite file, then pushes the current
// Prisma schema onto it - see backend/tests/integration/global-setup.ts for
// the equivalent used by the integration suite.
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  const filePath = DB_PATH + suffix;
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

execSync("npx prisma db push --accept-data-loss", {
  cwd: BACKEND_ROOT,
  env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` },
  stdio: "inherit",
});
