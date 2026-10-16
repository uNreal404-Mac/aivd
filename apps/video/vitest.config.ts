import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    fileParallelism: false,
    testTimeout: 30000,
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgresql://vf:vf@127.0.0.1:5432/videofly_test",
      DATABASE_SSL_MODE: "disable",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      BETTER_AUTH_SECRET: "test-secret-not-real",
    },
  },
});
