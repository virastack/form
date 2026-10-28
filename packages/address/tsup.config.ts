import { defineConfig, type Options } from "tsup";

const shared: Options = {
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  treeshake: true,
  external: ["react", "react-hook-form", "@virastack/address-data"],
  outExtension: ({ format }) => ({ js: format === "esm" ? ".mjs" : ".cjs" }),
};

export default defineConfig([
  { ...shared, entry: { index: "src/index.ts" }, clean: true, banner: { js: '"use client";' } },
  // The React Hook Form adapter is a separate entry so the core never pulls it in.
  { ...shared, entry: { rhf: "src/rhf.ts" }, clean: false, banner: { js: '"use client";' } },
  // No React and no "use client": the same lookups run in Server Components and Actions.
  { ...shared, entry: { server: "src/server.ts" }, clean: false },
]);
