// tsup names the CommonJS declarations `.d.ts`; rename them so every format has an explicit extension.
import { readdirSync, renameSync } from "node:fs";

for (const file of readdirSync("dist")) {
  if (file.endsWith(".d.ts")) renameSync(`dist/${file}`, `dist/${file.replace(/\.d\.ts$/, ".d.cts")}`);
}
