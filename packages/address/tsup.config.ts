import { resolve } from "node:path";

import { defineConfig, type Options } from "tsup";

type Plugin = NonNullable<Options["esbuildPlugins"]>[number];

const DATA = resolve("src/data.js");

// Every entry reads the dataset through dist/data, never through a copy of its
// own: one copy on disk, and one loader and cache, so setLoader() from
// "@virastack/address/data" reaches the hook and the server helpers too.
const sharedData: Plugin = {
  name: "shared-data",
  setup(build) {
    const file = build.initialOptions.format === "esm" ? "./data.mjs" : "./data.cjs";
    build.onResolve({ filter: /\/data\.js$/ }, (args) =>
      resolve(args.resolveDir, args.path) === DATA ? { path: file, external: true } : undefined,
    );
  },
};

const shared: Options = {
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  // The import map is shipped as data, not bundled: the consumer's bundler
  // splits it into one lazy chunk per province, and Node loads one at a time.
  external: ["react", "../data/load.mjs"],
  esbuildPlugins: [sharedData],
  outExtension: ({ format }) => ({ js: format === "esm" ? ".mjs" : ".cjs" }),
};

// tsup runs these blocks in parallel, so none of them cleans dist: a clean in one block could delete
// files another block already wrote. The build script empties dist first.
export default defineConfig([
  { ...shared, entry: { index: "src/index.ts" }, banner: { js: '"use client";' } },
  // No React and no "use client" below: the dataset and the lookups run anywhere,
  // in Server Components, Actions, a CLI or another framework entirely.
  { ...shared, entry: { data: "src/data.ts" } },
  { ...shared, entry: { server: "src/server.ts" } },
]);
