import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

// mask v2 is not on npm yet: the combined test runs when the mask repo sits next to this one.
const maskSource = fileURLToPath(new URL("../mask/src/index.ts", import.meta.url));
const hasMask = existsSync(maskSource);

export default defineConfig({
  resolve: {
    alias: { "@virastack/mask": hasMask ? maskSource : fileURLToPath(new URL("test/mask-missing.ts", import.meta.url)) },
    dedupe: ["react", "react-dom", "react-hook-form"],
  },
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
          env: { VIRASTACK_MASK: hasMask ? "1" : "" },
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
