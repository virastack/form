import fc from "fast-check";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useViraPassword } from "../src";
import * as server from "../src/server";
import { definePolicy, evaluate } from "../src/strength";

const { validatePassword } = server;
const policy = definePolicy();
const STRONG = "vu7#Kq2!mz9@Lw4X";

describe("validatePassword", () => {
  it("returns the engine result plus the normalized password", () => {
    expect(validatePassword(STRONG, policy)).toEqual({ ...evaluate(STRONG, policy), password: STRONG });
  });

  it("normalizes to NFKC for hashing", () => {
    const nfd = "Café-crème-brûlée!".normalize("NFD");
    expect(validatePassword(nfd, policy).password).toBe("Café-crème-brûlée!".normalize("NFC"));
    expect(validatePassword("ｐａｓｓ", policy).password).toBe("pass");
  });

  it("reads FormData values", () => {
    const form = new FormData();
    form.set("email", "omer.gulcicek@example.com");
    form.set("password", "gulcicek-garden-path");
    form.set("confirm", "gulcicek-garden-path");
    const result = validatePassword(form.get("password"), policy, {
      forbidden: [form.get("email")],
      confirm: form.get("confirm"),
    });
    expect(result.issues).toEqual(["password.containsPersonalInfo"]);
  });

  it.each([null, undefined, 42, {}, [], new File(["x"], "x.txt"), Symbol("x")])("treats malformed input %# as empty", (input) => {
    expect(validatePassword(input, policy)).toMatchObject({ valid: false, length: 0, issues: ["password.tooShort"], password: "" });
  });

  it("checks the confirmation", () => {
    expect(validatePassword(STRONG, policy, { confirm: STRONG }).valid).toBe(true);
    expect(validatePassword(STRONG, policy, { confirm: STRONG.normalize("NFD") }).valid).toBe(true);
    const mismatch = validatePassword(STRONG, policy, { confirm: "other" });
    expect(mismatch).toMatchObject({ valid: false, issues: ["password.mismatch"], level: "strong" });
    expect(validatePassword(STRONG, policy, { confirm: null }).issues).toEqual(["password.mismatch"]);
    expect(validatePassword(STRONG, policy, { confirm: undefined }).issues).toEqual(["password.mismatch"]);
    // A missing confirm value counts as empty, like a missing password.
    expect(validatePassword(null, policy, { confirm: null }).issues).toEqual(["password.tooShort"]);
    // Without the confirm key there is nothing to compare.
    expect(validatePassword(STRONG, policy, {}).issues).toEqual([]);
  });

  it("rejects huge payloads quickly", () => {
    const huge = "a".repeat(1_000_000);
    const start = performance.now();
    expect(validatePassword(huge, policy, { forbidden: ["a@b.co"] })).toMatchObject({ valid: false, issues: ["password.tooLong"] });
    expect(performance.now() - start).toBeLessThan(1000);
  });

  it("re-exports the policy helpers", () => {
    expect(server.definePolicy).toBe(definePolicy);
    expect(server.evaluate).toBe(evaluate);
    expect(server.normalizePassword("ﬁ")).toBe("fi");
  });
});

describe("client/server parity", () => {
  const policies = [policy, definePolicy({ preset: "legacy" }), definePolicy({ minLength: 6, blocklist: ["acme"], minTokenLength: 4 })];
  const text = fc.oneof(fc.string({ unit: "grapheme", maxLength: 40 }), fc.string({ maxLength: 40 }));
  const forbidden = fc.array(fc.oneof(fc.emailAddress(), fc.string({ maxLength: 12 })), { maxLength: 2 });

  it("server = evaluate() for any input", () => {
    fc.assert(
      fc.property(text, forbidden, fc.constantFrom(...policies), (password, values, p) => {
        const { password: _normalized, ...rest } = validatePassword(password, p, { forbidden: values });
        expect(rest).toEqual(evaluate(password, p, { forbidden: values }));
      }),
      { numRuns: 1000 },
    );
  });

  it("server = the hook's issues and rule for the same fields", () => {
    fc.assert(
      fc.property(text, fc.oneof(text, fc.constant("")), forbidden, (password, confirm, values) => {
        const pw = renderHook(() => useViraPassword({ policy, value: password, forbidden: values })).result.current;
        const cf = renderHook(() => useViraPassword({ matchWith: password, value: confirm })).result.current;
        const result = validatePassword(password, policy, { forbidden: values, confirm });
        expect(result.issues.filter((i) => i !== "password.mismatch")).toEqual(pw.issues);
        expect(result.issues.includes("password.mismatch")).toBe(cf.rule.validate(confirm) === "password.mismatch");
        expect(result.valid).toBe(pw.rule.validate(password) === true && cf.rule.validate(confirm) === true);
      }),
      { numRuns: 200 },
    );
  });
});
