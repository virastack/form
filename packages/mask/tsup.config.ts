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

// tsup runs these blocks in parallel, so none of them cleans dist: a clean in one block could delete
// files another block already wrote. The build script empties dist first.
export default defineConfig([
  // The hook entry runs on the client only.
  { ...shared, entry: { index: "src/index.ts" }, banner: { js: '"use client";' } },
  // The server entry has no React and no "use client", so Server Components and Actions can call it.
  { ...shared, entry: { server: "src/server.ts" } },
  // Test and seed generators: kept out of the other entries, so they never ship to production code.
  { ...shared, entry: { testing: "src/testing.ts" } },
]);
