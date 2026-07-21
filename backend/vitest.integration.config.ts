import path from "node:path";
import { defineConfig } from "vitest/config";

const TEST_DB_PATH = path.join(__dirname, "prisma", "test.db");

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["./tests/integration/global-setup.ts"],
    setupFiles: ["./tests/integration/setup-each.ts"],
    env: {
      DATABASE_URL: `file:${TEST_DB_PATH}`,
      RECALL_REGION: "us-west-2",
      RECALL_API_KEY: "test-api-key",
      RECALL_WORKSPACE_VERIFICATION_SECRET: `whsec_${Buffer.from("test-signing-key-material").toString("base64")}`,
      OPENAI_API_KEY: "test-openai-key",
    },
    // A single shared SQLite file - run test files sequentially so
    // beforeEach's cleanup in one file can't race with another.
    fileParallelism: false,
  },
});
