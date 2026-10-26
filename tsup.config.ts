import { defineConfig, type Options } from "tsup";

const shared: Options = {
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  splitting: false,
  target: "es2022",
  external: ["react", "react-dom"],
  outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".mjs" }),
};

export default defineConfig([
  // The hook entry runs on the client only.
  { ...shared, entry: { index: "src/index.ts" }, clean: true, banner: { js: '"use client";' } },
]);
