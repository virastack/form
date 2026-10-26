import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src"],
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 },
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
