// Checks the built package: entries resolve from ESM and CJS, "use client" is only on the hook,
// the entries without React stay without React, and the hook bundle does not carry the strength engine.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const failures = [];
const check = (name, ok) => {
  if (!ok) failures.push(name);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
};

const entries = {
  "@virastack/password": ["useViraPassword", "mergeProps", "composeRefs", "EyeIcon", "EyeOffIcon", "getInputType"],
  "@virastack/password/strength": ["definePolicy", "evaluate", "normalizePassword"],
  "@virastack/password/server": ["validatePassword", "definePolicy", "evaluate", "normalizePassword"],
  "@virastack/password/pwned": ["checkPwned"],
};

for (const [specifier, names] of Object.entries(entries)) {
  const esm = await import(specifier);
  const cjs = require(specifier);
  for (const name of names) {
    check(`${specifier} exports ${name} (ESM)`, typeof esm[name] === "function");
    check(`${specifier} exports ${name} (CJS)`, typeof cjs[name] === "function");
  }
}

for (const file of ["index", "strength", "server", "pwned"]) {
  for (const ext of ["mjs", "cjs"]) {
    const code = readFileSync(`dist/${file}.${ext}`, "utf8");
    const client = code.startsWith('"use client";');
    check(`dist/${file}.${ext} ${file === "index" ? "starts with" : "has no"} "use client"`, file === "index" ? client : !code.includes("use client"));
    if (file !== "index") check(`dist/${file}.${ext} does not import React`, !/from ["']react|require\(["']react/.test(code));
  }
}

// A relative import in a declaration file points at a sibling that may not exist for CJS.
for (const file of ["index", "strength", "server", "pwned"]) {
  for (const ext of ["d.mts", "d.cts"]) {
    check(`dist/${file}.${ext} is self-contained`, !/from ['"]\.\//.test(readFileSync(`dist/${file}.${ext}`, "utf8")));
  }
}

for (const ext of ["mjs", "cjs"]) {
  const code = readFileSync(`dist/index.${ext}`, "utf8");
  check(`dist/index.${ext} does not include the strength engine`, !/galatasaray|qwertyuiop|definePolicy/.test(code));
}

// Separate bundles: a policy made by the strength entry must work in the server entry.
const policy = (await import("@virastack/password/strength")).definePolicy();
const fromServer = (await import("@virastack/password/server")).validatePassword("vu7#Kq2!mz9@Lw4X", policy);
check("server entry validates with a policy from the strength entry", fromServer.valid === true);

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nAll dist checks passed");
