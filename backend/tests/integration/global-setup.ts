import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BACKEND_ROOT = path.join(__dirname, "..", "..");
const TEST_DB_PATH = path.join(BACKEND_ROOT, "prisma", "test.db");
export const TEST_DATABASE_URL = `file:${TEST_DB_PATH}`;

/**
 * Runs once before the whole integration suite: starts from a clean SQLite
 * file and pushes the current schema onto it, so tests run against the real
 * Prisma schema/migrations rather than a hand-maintained fixture DB.
 */
export default function setup() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const filePath = TEST_DB_PATH + suffix;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  execSync("npx prisma db push --accept-data-loss", {
    cwd: BACKEND_ROOT,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });
}
