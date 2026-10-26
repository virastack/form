// Property-based tests: random input, invariants that must always hold.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { definePolicy, evaluate } from "../src/strength";

const policies = [definePolicy(), definePolicy({ preset: "legacy" }), definePolicy({ minLength: 4, maxLength: 20, blocklist: ["acme"] })];
const anyString = fc.oneof(fc.string({ unit: "grapheme", maxLength: 80 }), fc.string({ unit: "binary", maxLength: 80 }), fc.string({ maxLength: 80 }));
const forbidden = fc.array(fc.oneof(fc.emailAddress(), fc.string({ maxLength: 20 }), fc.constant(null)), { maxLength: 3 });

describe("evaluate invariants", () => {
  it("never throws, and valid, score, level and issues agree", () => {
    fc.assert(
      fc.property(anyString, forbidden, fc.constantFrom(...policies), (password, values, policy) => {
        const result = evaluate(password, policy, { forbidden: values });
        expect(result.valid).toBe(result.issues.length === 0);
        if (result.valid) expect(result.score).toBeGreaterThanOrEqual(2);
        else expect(result.score).toBeLessThanOrEqual(1);
        expect(result.level).toBe(["weak", "weak", "fair", "good", "strong"][result.score]);
        expect(new Set(result.issues).size).toBe(result.issues.length);
        expect(result.checks.minLength).toBe(result.length >= policy.minLength);
        expect(result.checks.maxLength).toBe(result.length <= policy.maxLength);
      }),
      { numRuns: 2000 },
    );
  });

  it("gives the same result for NFC, NFD and NFKC forms", () => {
    fc.assert(
      fc.property(fc.string({ unit: "grapheme", maxLength: 40 }), (password) => {
        const base = evaluate(password.normalize("NFKC"), policies[0]);
        expect(evaluate(password.normalize("NFD"), policies[0])).toEqual(base);
        expect(evaluate(password.normalize("NFC"), policies[0])).toEqual(base);
        expect(evaluate(password, policies[0])).toEqual(base);
      }),
      { numRuns: 1000 },
    );
  });

  it("length is the code point count after NFKC, without zero-width characters", () => {
    fc.assert(
      fc.property(fc.string({ unit: "grapheme", maxLength: 40 }), (password) => {
        const expected = Array.from(password.normalize("NFKC").replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")).length;
        expect(evaluate(password, policies[0]).length).toBe(expected);
      }),
    );
  });

  it("is deterministic", () => {
    fc.assert(
      fc.property(anyString, (password) => {
        expect(evaluate(password, policies[1])).toEqual(evaluate(password, policies[1]));
      }),
    );
  });

  it("a password containing a forbidden email's local part is rejected", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{4,12}$/), fc.stringMatching(/^[a-z0-9]{0,8}$/), (local, suffix) => {
        const result = evaluate(`Xq9!${local}${suffix}#Zr7`, policies[0], { forbidden: [`${local}@example.com`] });
        expect(result.issues).toContain("password.containsPersonalInfo");
      }),
    );
  });
});
