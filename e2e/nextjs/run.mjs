// Packs @virastack/password, installs the tarball into a Next.js app and drives it in Chromium,
// once against `next start` and once against `next dev` (stricter hydration checks).
// Usage: pnpm e2e:next
import { execSync, spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const app = fileURLToPath(new URL(".", import.meta.url));
const root = fileURLToPath(new URL("../..", import.meta.url));
const run = (command, cwd) => execSync(command, { cwd, stdio: "inherit" });

run("pnpm build", root);
mkdirSync(`${app}.pack`, { recursive: true });
run(`pnpm pack --out ${app}.pack/password.tgz`, root);
rmSync(`${app}node_modules/@virastack/password`, { recursive: true, force: true });
run("npm install --no-package-lock --no-audit --no-fund --legacy-peer-deps", app);
run("npx next build", app);

let failures = 0;

for (const mode of ["start", "dev"]) {
  const port = mode === "start" ? 3467 : 3468;
  const server = spawn("npx", ["next", mode, "-p", String(port)], { cwd: app, stdio: "ignore", detached: true });
  try {
    await waitFor(`http://localhost:${port}`);
    failures += await checks(`http://localhost:${port}`, mode);
  } finally {
    process.kill(-server.pid);
  }
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll Next.js e2e checks passed");

async function waitFor(url) {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await sleep(500);
  }
  throw new Error(`${url} did not start`);
}

async function checks(base, mode) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const problems = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(String(error)));

  let failed = 0;
  const check = (name, actual, expected) => {
    const ok = typeof expected === "function" ? expected(actual) : actual === expected;
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"} [${mode}] ${name}${ok ? "" : ` → got ${JSON.stringify(actual)}`}`);
  };

  const field = (label) => page.getByLabel(label, { exact: true });
  const text = (id) => page.getByTestId(id).textContent();
  const result = async () => JSON.parse(await text("result"));
  const submit = async () => {
    await page.getByRole("button", { name: "Sign up" }).click();
    await page.waitForFunction(() => document.querySelector('[data-testid="result"]')?.textContent !== "null");
  };

  // Server-rendered HTML, before hydration.
  const html = await (await fetch(base)).text();
  check("SSR renders a password input", /<input[^>]*type="password"/.test(html), true);
  check("SSR sets autocomplete new-password", html.includes('autoComplete="new-password"') || html.includes('autocomplete="new-password"'), true);

  await page.goto(base);
  await page.waitForLoadState("networkidle");

  const table = await page.getByTestId("server-table").textContent();
  check("server entry in an RSC", table.includes("password.tooShort"), true);
  check("strength entry in an RSC", table.includes("password.common") && table.includes("password.blocked") && table.includes("strong"), true);

  await field("password").click();
  await page.keyboard.type("short", { delay: 5 });
  check("strength while typing", await text("level"), "weak");
  check("issue keys", await text("issues"), "password.tooShort");
  await field("password").fill("");
  await field("password").click();
  await page.keyboard.type("vu7#Kq2!mz9@Lw4X", { delay: 5 });
  check("strong password", await text("level"), "strong");

  await page.getByRole("button", { name: "Show password" }).click();
  check("toggle shows the password", await field("password").getAttribute("type"), "text");
  check("focus returns to the input", await page.evaluate(() => document.activeElement?.getAttribute("name")), "password");

  await field("confirm").click();
  await page.keyboard.type("vu7#Kq2!mz9@Lw4", { delay: 5 });
  check("confirm mismatch", await text("matches"), "false");
  await page.keyboard.type("X");
  check("confirm match", await text("matches"), "true");

  await submit();
  check("server action accepts", (await result()).valid, true);
  check("submit hid the password", await field("password").getAttribute("type"), "password");

  // Personal info on the server.
  await field("password").fill("omer-garden-path-long");
  await field("confirm").fill("omer-garden-path-long");
  await page.evaluate(() => (document.querySelector('[data-testid="result"]').textContent = "null"));
  await submit();
  check("server rejects personal info", (await result()).issues?.[0], "password.containsPersonalInfo");

  await field("confirm").fill("something-else-entirely");
  await page.evaluate(() => (document.querySelector('[data-testid="result"]').textContent = "null"));
  await submit();
  check("server rejects a mismatch", (await result()).issues, (issues) => issues?.includes("password.mismatch"));

  check("no console errors or warnings", problems, (list) => list.length === 0);
  for (const problem of problems) console.log(`   console: ${problem}`);

  await browser.close();
  return failed;
}
