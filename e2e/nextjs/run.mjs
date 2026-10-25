// Packs @virastack/mask, installs the tarball into a Next.js app and drives it in Chromium,
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
run(`pnpm pack --out ${app}.pack/mask.tgz`, root);
rmSync(`${app}node_modules/@virastack/mask`, { recursive: true, force: true });
run("npm install --no-package-lock --no-audit --no-fund --legacy-peer-deps", app);
run("npx next build", app);

let failures = 0;

for (const mode of ["start", "dev"]) {
  const port = mode === "start" ? 3457 : 3458;
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
  const value = (label) => field(label).inputValue();
  const watch = async () => JSON.parse(await page.getByTestId("watch").textContent());
  const type = async (label, text) => {
    await field(label).click();
    await page.keyboard.type(text, { delay: 5 });
  };
  const result = async () => JSON.parse(await page.getByTestId("result").textContent());

  await page.goto(base);
  await page.waitForLoadState("networkidle");

  // Server Component: the server entry formats without "use client".
  const table = await page.getByTestId("server-table").textContent();
  check("server entry formats in an RSC", table.includes("(555) 123 45 67") && table.includes("123456"), true);

  // SSR default values
  check("SSR default phone", await value("phone"), "(555) 123 45 67");
  check("SSR default price", await value("price"), "₺1.234,5");

  // Typing every preset
  await field("phone").fill("");
  await type("phone", "05321112233");
  check("phone TR strips the leading 0", await value("phone"), "(532) 111 22 33");
  await type("intl", "+905551234567");
  check("phone E.164 switches to the TR layout", await value("intl"), "+90 (555) 123 45 67");
  await type("tckn", "10000000146");
  await type("vkn", "1234567890");
  await type("iban", "TR330006100519786457841326");
  check("iban TR", await value("iban"), "TR33 0006 1005 1978 6457 8413 26");
  await type("ibanAny", "gb82west12345698765432");
  check("iban any country", await value("ibanAny"), "GB82 WEST 1234 5698 7654 32");
  await type("card", "378282246310005");
  check("card Amex layout", await value("card"), "3782 822463 10005");
  check("onComplete fired", await page.getByTestId("completed").textContent(), "378282246310005");
  await type("cvv", "12345");
  check("cvv has 4 digits for Amex", await value("cvv"), "1234");
  await type("expiry", "1299");
  check("expiry", await value("expiry"), "12/99");
  await field("price").fill("");
  await type("price", "2500,75");
  check("price TRY", await value("price"), "₺2.500,75");
  await type("qty", "250");
  check("number clamps to max", await value("qty"), "99");
  await type("birth", "12051990");
  check("date", await value("birth"), "12/05/1990");
  await type("start", "10022026");
  await type("end", "01022026");
  await type("zip", "34000");
  await type("plate", "34abc123");
  check("custom pattern", await value("plate"), "34 ABC 123");

  // The form keeps raw values
  const watched = await watch();
  check("watch phone is raw", watched.phone, "5321112233");
  check("watch intl is E.164", watched.intl, "+905551234567");
  check("watch price is raw", watched.price, "2500.75");
  check("watch birth is ISO", watched.birth, "1990-05-12");
  check("watch nested zip", watched.address?.zip, "34000");

  // Linked fields
  await field("currency").selectOption("USD");
  await page.waitForTimeout(50);
  check("price follows the currency select", await value("price"), "$2,500.75");
  await field("card").fill("");
  await type("card", "4111111111111111");
  await page.waitForTimeout(50);
  check("cvv is trimmed when the card changes", await value("cvv"), "123");
  check("cvv raw is trimmed", (await watch()).cvv, "123");

  // Validation: end before start
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await page.waitForTimeout(300);
  check("end before start", (await page.getByTestId("end-error").textContent().catch(() => "")).length > 0, true);

  // Server Action with raw values
  await field("end").fill("");
  await type("end", "20022026");
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-testid="result"]')?.textContent?.includes("success"));
  let response = await result();
  check("server action succeeds", response.success, true);
  check("server action gets the raw phone", response.data.phone, "5321112233");

  // FormData with masked text parsed on the server
  await page.getByRole("button", { name: "Submit FormData" }).click();
  await page.waitForTimeout(500);
  response = await result();
  check("FormData is parsed", response.success, true);
  check("FormData price is raw", response.data.price, "2500.75");
  check("FormData nested zip", response.data.address?.zip, "34000");

  // Error keys on the server and the client
  await field("tckn").fill("");
  await type("tckn", "12345678901");
  await page.getByRole("button", { name: "Submit FormData" }).click();
  await page.waitForTimeout(500);
  check("server error key", (await result()).errors?.tckn, "tckn.invalid");
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await page.waitForTimeout(300);
  check("client error via maskResolver", (await page.getByTestId("tckn-error").textContent()).length > 0, true);

  // reset() and setValue()
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.waitForTimeout(100);
  check("reset() restores defaults", await value("phone"), "(555) 123 45 67");
  check("reset() clears tckn", await value("tckn"), "");
  await page.getByRole("button", { name: "Reset with values" }).click();
  await page.waitForTimeout(100);
  check("reset(values)", await value("birth"), "12/05/1990");
  await page.getByRole("button", { name: "Set IBAN" }).click();
  check("setValue()", await value("iban"), "TR33 0006 1005 1978 6457 8413 26");

  // Caret after backspace over a separator
  await field("phone").click();
  await page.evaluate(() => document.querySelector('input[name="phone"]').setSelectionRange(6, 6));
  await page.keyboard.press("Backspace");
  check("backspace over a separator", await value("phone"), "(531) 112 23 3");
  check("caret after backspace", await page.evaluate(() => document.querySelector('input[name="phone"]').selectionStart), 3);

  check("no console errors or warnings", problems, (list) => list.length === 0);
  for (const problem of problems) console.log(`   console: ${problem}`);

  await browser.close();
  return failed;
}
