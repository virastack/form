import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { validatePassword } from "../src/server";
import { definePolicy, evaluate, normalizePassword } from "../src/strength";

const nist = definePolicy();
const STRONG = "vu7#Kq2!mz9@Lw4X-bt5Rn8Jy";
const issues = (password: string, policy = nist, forbidden?: unknown[]) => evaluate(password, policy, { forbidden }).issues;

const sha1 = (text: string) => createHash("sha1").update(text, "utf8").digest("hex").toUpperCase();
/** A Pwned Passwords range response that lists `password` with `count`. */
const rangeWith = (password: string, count: number) =>
  vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(`${sha1(password).slice(5)}:${count}\r\n`));

describe("mfa preset", () => {
  it("is 8–64 characters without composition rules", () => {
    const mfa = definePolicy({ preset: "mfa" });
    expect(mfa).toMatchObject({ preset: "mfa", minLength: 8, maxLength: 64 });
    expect(Object.values(mfa.require).some(Boolean)).toBe(false);
    expect(evaluate("kjhqwmzx", mfa)).toMatchObject({ valid: true, score: 2 });
    expect(issues("kjhqwmz", mfa)).toEqual(["password.tooShort"]);
  });

  it("still blocks common, repeated and personal passwords", () => {
    const mfa = definePolicy({ preset: "mfa" });
    expect(issues("Password1!", mfa)).toEqual(["password.common"]);
    expect(issues("aaaaaaaa", mfa)).toEqual(["password.repetitive"]);
    expect(issues("selin1990", mfa, ["selin@example.com"])).toEqual(["password.containsPersonalInfo"]);
  });
});

describe("normalization", () => {
  it("defaults to NFKC", () => {
    expect(nist.normalization).toBe("NFKC");
    expect(normalizePassword("ｐａｓｓ")).toBe("pass");
  });

  it("NFC keeps full-width letters and ligatures, and still composes accents", () => {
    const nfc = definePolicy({ normalization: "NFC" });
    expect(normalizePassword("ｐａｓｓ", "NFC")).toBe("ｐａｓｓ");
    expect(normalizePassword("ﬁ", "NFC")).toBe("ﬁ");
    expect(normalizePassword("café".normalize("NFD"), "NFC")).toBe("café");
    expect(validatePassword("ｐａｓｓ", nfc).password).toBe("ｐａｓｓ");
    expect(validatePassword("ｐａｓｓ", nist).password).toBe("pass");
  });

  it("compares the confirmation with the policy's normalization", () => {
    const nfc = definePolicy({ normalization: "NFC" });
    const fullWidth = "ｓｅｃｒｅｔ-ｐｈｒａｓｅ-ｏｎｅ";
    const ascii = "secret-phrase-one";
    expect(validatePassword(fullWidth, nist, { confirm: ascii }).issues).not.toContain("password.mismatch");
    expect(validatePassword(fullWidth, nfc, { confirm: ascii }).issues).toContain("password.mismatch");
  });

  it("rejects an unknown form", () => {
    // @ts-expect-error not a supported form
    expect(() => definePolicy({ normalization: "NFD" })).toThrow(RangeError);
  });
});

describe("whole-password comparison (NIST SP 800-63B-4)", () => {
  it("a short name inside an ordinary word no longer fails the password", () => {
    // 1.1 rejected all of these: each contains "ali", "can" or "ece".
    for (const password of ["kalitelibirsabahkahvesi", "valizimi-hazirladim-bile", "candlelight-garden-91", "tecelli-eden-bir-sabah"]) {
      expect(issues(password, nist, ["Ali Can Ece"])).toEqual([]);
    }
  });

  it("the name itself with digits, symbols, leetspeak or repetition still fails", () => {
    for (const password of ["ali1990ali1990!", "4li-1990-2024-!!", "ali!ali!ali!ali!", "alican-1990-2024"]) {
      expect(issues(password, nist, ["Ali Can"])).toContain("password.containsPersonalInfo");
    }
  });

  it("keeps a word whose start and end repeat", () => {
    // The unit of "salsa" is "sal"; the word itself must still match.
    expect(issues("salsa-1990-2024-!!", definePolicy({ blocklist: ["salsa"] }))).toEqual(["password.blocked"]);
  });
});

describe("repetition", () => {
  it.each(["aaaabbbbccccdddd", "aabbccddeeffgghh", "111122223333444455"])("runs of one character: %s", (password) => {
    expect(issues(password)).toContain("password.repetitive");
  });

  it.each(["bookkeeper-coffee-2024", "mississippi-river-boat", "aa-bb-cc-dd-ee-ff-gg-x"])("normal doubles pass: %s", (password) => {
    expect(issues(password)).not.toContain("password.repetitive");
  });
});

describe("score", () => {
  it("is the same with or without uppercase letters, digits and symbols", () => {
    for (const [plain, mixed] of [
      ["denizkenarindas", "Denizkenarinda1"],
      ["kedimbugunuyudu", "Kedimbugunuyud!"],
      ["denizkenarindasabahkahvesi", "Deniz.kenarinda-sabah-1!"],
    ]) {
      expect(evaluate(plain, nist).level).toBe(evaluate(mixed, nist).level);
    }
  });
});

describe("validatePassword with pwned", () => {
  it("adds password.pwned and scores 0 when the password is in a breach", async () => {
    const fetch = rangeWith(STRONG, 42);
    const result = await validatePassword(STRONG, nist, { pwned: { fetch } });
    expect(result).toMatchObject({ valid: false, score: 0, level: "weak", issues: ["password.pwned"], pwned: { status: "pwned", count: 42 } });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("stays valid when the password is not found", async () => {
    const fetch = rangeWith("something-else-entirely", 3);
    const result = await validatePassword(STRONG, nist, { pwned: { fetch } });
    expect(result).toMatchObject({ valid: true, issues: [], pwned: { status: "safe" } });
  });

  it("never blocks on a failed lookup", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("offline");
    });
    const result = await validatePassword(STRONG, nist, { pwned: { fetch } });
    expect(result).toMatchObject({ valid: true, pwned: { status: "unknown", reason: "network" } });
  });

  it("skips the request when the policy already fails", async () => {
    const fetch = rangeWith("short", 1);
    const result = await validatePassword("short", nist, { pwned: { fetch } });
    expect(fetch).not.toHaveBeenCalled();
    expect(result.pwned).toBeUndefined();
    expect(result.issues).toEqual(["password.tooShort"]);
  });

  it("still looks up when only the confirmation differs, and keeps both issues", async () => {
    const fetch = rangeWith(STRONG, 7);
    const result = await validatePassword(STRONG, nist, { confirm: "other", pwned: { fetch } });
    expect(result.issues).toEqual(["password.mismatch", "password.pwned"]);
  });

  it("looks up the normalized password", async () => {
    const fetch = rangeWith(STRONG, 5);
    const result = await validatePassword(STRONG.normalize("NFD"), nist, { pwned: { fetch } });
    expect(result.pwned).toEqual({ status: "pwned", count: 5 });
  });

  it("is synchronous without the option", () => {
    expect(validatePassword(STRONG, nist)).not.toBeInstanceOf(Promise);
    expect(validatePassword(STRONG, nist, { pwned: false })).not.toBeInstanceOf(Promise);
  });
});
