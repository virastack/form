import { defineConfig, type Options } from "tsup";

const shared: Options = {
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  splitting: false,
  target: "es2022",
  external: ["react", "react-dom", "react-hook-form"],
  outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".mjs" }),
};

export default defineConfig([
  // The hook entry runs on the client only.
  { ...shared, entry: { index: "src/index.ts" }, clean: true, banner: { js: '"use client";' } },
  // The server entry has no React and no "use client", so Server Components and Actions can call it.
  { ...shared, entry: { server: "src/server.ts" }, clean: false },
]);
