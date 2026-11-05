import { defineConfig, type Options } from "tsup";

const shared: Options = {
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  splitting: false,
  target: "es2022",
  // react-hook-form is an optional peer; the root entry only imports its types.
  external: ["react", "react-dom", "react-hook-form"],
  outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".mjs" }),
};

// tsup runs these blocks in parallel, so none of them cleans dist: a clean in one block could delete
// files another block already wrote. The build script empties dist first.
export default defineConfig([
  // The hook entry runs on the client only.
  { ...shared, entry: { index: "src/index.ts" }, banner: { js: '"use client";' } },
  // No React and no "use client": the same policy runs in the form, in Server Components and in Actions.
  // One block per entry, so each declaration file is self-contained.
  { ...shared, entry: { strength: "src/strength/index.ts" } },
  { ...shared, entry: { server: "src/server.ts" } },
  { ...shared, entry: { pwned: "src/pwned.ts" } },
]);
