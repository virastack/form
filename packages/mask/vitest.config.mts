import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src"],
      // Keep a little headroom under the current numbers so a drop fails CI.
      thresholds: { statements: 92, branches: 85, functions: 92, lines: 94 },
    },
    projects: [
      {
        test: {
          name: "unit",
          environment: "jsdom",
          include: ["test/**/*.test.{ts,tsx}"],
          exclude: ["test/browser/**"],
          setupFiles: ["test/setup.ts"],
        },
      },
      {
        test: {
          name: "browser",
          include: ["test/browser/**/*.test.{ts,tsx}"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }, { browser: "firefox" }, { browser: "webkit" }],
          },
        },
      },
    ],
  },
});
