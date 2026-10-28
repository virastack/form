import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src"],
      thresholds: { statements: 85, branches: 85, functions: 85, lines: 85 },
    },
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["test/**/*.test.ts"],
        },
      },
    ],
  },
});
