import { describe, expect, it } from "vitest";
import { definePolicy, evaluate, normalizePassword, type PasswordIssue } from "../src/strength";

const nist = definePolicy();
const legacy = definePolicy({ preset: "legacy" });
const issues = (password: string, policy = nist, forbidden?: unknown[]): PasswordIssue[] =>
  evaluate(password, policy, { forbidden }).issues;

// 15 distinct characters, no word, no run.
const OK15 = "vu7#Kq2!mz9@Lw4";

describe("definePolicy", () => {
  it("defaults to NIST SP 800-63B-4: 15–64 characters, no composition rules", () => {
    expect(nist).toMatchObject({
      preset: "nist",
      minLength: 15,
      maxLength: 64,
      require: { lowercase: false, uppercase: false, digit: false, symbol: false },
      blockCommon: true,
      blockRepetitive: true,
      blocklist: [],
      minTokenLength: 3,
    });
  });

  it("legacy requires all four classes from 8 characters", () => {
    expect(legacy).toMatchObject({
      minLength: 8,
      maxLength: 64,
      require: { lowercase: true, uppercase: true, digit: true, symbol: true },
    });
  });

  it("overrides preset values", () => {
    const custom = definePolicy({ preset: "legacy", minLength: 12, require: { symbol: false } });
    expect(custom.minLength).toBe(12);
    expect(custom.require).toEqual({ lowercase: true, uppercase: true, digit: true, symbol: false });
    expect(definePolicy({ minLength: 8 }).minLength).toBe(8);
  });

  it("is frozen", () => {
    expect(Object.isFrozen(nist)).toBe(true);
    expect(Object.isFrozen(nist.require)).toBe(true);
    expect(Object.isFrozen(nist.blocklist)).toBe(true);
  });

  it("accepts rules right at their limits", () => {
    expect(definePolicy({ minLength: 10, maxLength: 10 }).minLength).toBe(10);
    expect(definePolicy({ preset: "legacy", minLength: 4, maxLength: 4 }).maxLength).toBe(4);
    expect(definePolicy({ minLength: 1, maxLength: 1 }).maxLength).toBe(1);
  });

  it.each([
    [{ minLength: 20, maxLength: 10 }, /greater than maxLength/],
    [{ minLength: 0 }, /minLength must be a positive integer/],
    [{ minLength: 1.5 }, /minLength must be a positive integer/],
    [{ maxLength: Number.NaN }, /maxLength must be a positive integer/],
    [{ minTokenLength: -1 }, /minTokenLength/],
    [{ preset: "nope" as "nist" }, /unknown preset/],
    [{ preset: "legacy" as const, minLength: 1, maxLength: 3 }, /do not fit/],
  ])("rejects conflicting or broken rules %#", (options, message) => {
    expect(() => definePolicy(options)).toThrow(message);
  });

  it("evaluate() and policy.evaluate() agree", () => {
    expect(evaluate(OK15, nist)).toEqual(nist.evaluate(OK15));
  });
});

describe("length", () => {
  it("empty", () => {
    expect(evaluate("", nist)).toEqual({
      score: 0,
      level: "weak",
      length: 0,
      valid: false,
      checks: { minLength: false, maxLength: true, notCommon: true, notBlocked: true, notRepetitive: true, notPersonal: true },
      issues: ["password.tooShort"],
    });
  });

  it("one character", () => {
    expect(evaluate("x", nist)).toMatchObject({ length: 1, score: 0, issues: ["password.tooShort"] });
  });

  it("14 fails, 15 passes", () => {
    expect(issues(OK15.slice(0, 14))).toEqual(["password.tooShort"]);
    expect(evaluate(OK15.slice(0, 14), nist).score).toBe(1);
    expect(evaluate(OK15, nist)).toMatchObject({ valid: true, length: 15 });
  });

  it("64 passes, 65 fails without being cut", () => {
    const s64 = (OK15 + "Ab3$" + OK15.toUpperCase() + "gh5%" + OK15 + "Np8^" + OK15).slice(0, 64);
    expect(s64).toHaveLength(64);
    expect(evaluate(s64, nist)).toMatchObject({ valid: true, length: 64 });
    expect(evaluate(s64 + "z", nist)).toMatchObject({ valid: false, length: 65, issues: ["password.tooLong"] });
  });

  it("handles very long input quickly", () => {
    const huge = Array.from({ length: 20_000 }, (_, i) => String.fromCharCode(33 + ((i * 7919) % 94))).join("");
    const start = performance.now();
    const result = evaluate(huge, nist, { forbidden: ["someone@example.com", "Some Name"] });
    expect(performance.now() - start).toBeLessThan(500);
    expect(result.length).toBe(20_000);
    expect(result.issues).toContain("password.tooLong");
  });

  it("only spaces", () => {
    expect(issues(" ".repeat(15))).toEqual(["password.repetitive"]);
  });

  it("does not trim spaces", () => {
    expect(evaluate(`  ${OK15.slice(0, 13)}`, nist)).toMatchObject({ length: 15, valid: true });
  });
});

describe("Unicode", () => {
  it("counts code points, so emoji count once", () => {
    const pw = "🔒kq7🌙Lw2🚀zx9🎉mY";
    expect(evaluate(pw, nist)).toMatchObject({ length: 15, valid: true });
  });

  it("counts Turkish letters once", () => {
    const pw = "çığır-açan-şöğüt";
    expect(evaluate(pw, nist).length).toBe(16);
    expect(evaluate(pw, nist).valid).toBe(true);
  });

  it("NFC and NFD input give the same result", () => {
    const nfc = "café-crème-brûlée!".normalize("NFC");
    const nfd = nfc.normalize("NFD");
    expect(nfd.length).toBeGreaterThan(nfc.length);
    expect(evaluate(nfd, nist)).toEqual(evaluate(nfc, nist));
    expect(evaluate(nfc, nist).length).toBe(18);
  });

  it("applies NFKC: full-width and ligatures", () => {
    expect(normalizePassword("ｐａｓｓｗｏｒｄ")).toBe("password");
    expect(normalizePassword("ﬁ")).toBe("fi");
    expect(issues("ｐａｓｓｗｏｒｄｐａｓｓｗｏｒｄ")).toEqual(["password.common"]);
  });

  it("ignores zero-width characters in the length", () => {
    const pw = OK15.slice(0, 14) + "\u200B";
    expect(evaluate(pw, nist)).toMatchObject({ length: 14, issues: ["password.tooShort"] });
    expect(evaluate("\u200D".repeat(20), nist).length).toBe(0);
    // Zero-width characters do not hide a common password either.
    expect(issues("pass\u200Bword\uFEFFpassword")).toContain("password.common");
  });

  it("right-to-left scripts", () => {
    const hebrew = "סיסמהארוכהמאודב";
    const arabic = "كلمةمرورطويلةجدا";
    expect(evaluate(hebrew, nist)).toMatchObject({ length: 15, valid: true });
    expect(evaluate(arabic, nist).valid).toBe(true);
    expect(evaluate(arabic, nist).score).toBeGreaterThanOrEqual(3);
  });

  it("a ZWJ emoji sequence counts its visible parts", () => {
    // 👨\u200D👩\u200D👧 is 5 code points, 2 of them ZWJ.
    expect(evaluate("👨\u200D👩\u200D👧", nist).length).toBe(3);
  });

  it("lone surrogates do not throw", () => {
    expect(() => evaluate("\uD800abc\uDC00defghijklmnop", nist)).not.toThrow();
  });
});

describe("common passwords", () => {
  it.each([
    "password",
    "Password1234567!",
    "P@ssw0rd123456789",
    "passwordpassword",
    "PASSWORD-PASSWORD",
    "galatasaray1905!!",
    "Fenerbahçe1907190",
    "Şifre123456789012",
    "iloveyou12345678",
    "correct horse battery staple",
    "qwerty123456789!",
    "1234567890qwerty",
    "summer2024summer2024",
    "passwordpass1234567",
  ])("%s", (pw) => {
    expect(issues(pw)).toContain("password.common");
  });

  it.each(["correct horse battery stapler", "passwords are not words", "my dog ate my homework", "galatasaray-kadikoy-moda-90"])(
    "not common: %s",
    (pw) => {
      expect(issues(pw)).not.toContain("password.common");
    },
  );

  it("is a hard fail with score 0", () => {
    expect(evaluate("passwordpassword", nist)).toMatchObject({ score: 0, level: "weak", valid: false });
  });

  it("can be turned off", () => {
    expect(issues("passwordpassword", definePolicy({ blockCommon: false }))).toEqual([]);
  });

  it("short inputs only report length", () => {
    expect(issues("abc")).toEqual(["password.tooShort"]);
    expect(issues("pass")).toEqual(["password.tooShort"]);
    expect(issues("aaaa")).toEqual(["password.tooShort", "password.repetitive"]);
  });
});

describe("repetition and sequences", () => {
  it.each([
    "aaaaaaaaaaaaaaa",
    "abababababababab",
    "abcabcabcabcabc",
    "abcdeabcdeabcde",
    "121212121212121",
    "123456789012345",
    "098765432109876",
    "abcdefghijklmnop",
    "zyxwvutsrqponml",
    "qwertyuiopasdfgh",
    "qwertyuıopğüasdf",
    "azertyuiopqsdfgh",
    "1qaz2wsx3edc4rfv",
    "aaaaaaaaaaaaaaaZ",
    "abcdeabcdeabcdeab",
    "xk9#xk9#xk9#xk9#x",
  ])("%s", (pw) => {
    expect(issues(pw)).toContain("password.repetitive");
  });

  it("finds units that need the KMP fallback", () => {
    // "aab" repeated: the prefix function has to fall back to find the period.
    expect(issues("aabxaabxaabxaabx")).toContain("password.repetitive");
    expect(issues("abacabadabacabae")).not.toContain("password.repetitive");
  });

  it.each(["xk9#mQ2!xk9#mQ2!", OK15, "the-rain-in-spain-falls", "ab12cd34ef56gh78"])("not repetitive: %s", (pw) => {
    expect(issues(pw)).not.toContain("password.repetitive");
  });

  it("can be turned off", () => {
    expect(issues("aaaaaaaaaaaaaaa", definePolicy({ blockRepetitive: false }))).toEqual([]);
  });
});

describe("policy blocklist", () => {
  const policy = definePolicy({ blocklist: ["ViraStack", "", "  ", "Vira Stack Pro"] });

  it("blocks words the password contains, ignoring case, accents and leetspeak", () => {
    expect(issues("my-virastack-account", policy)).toEqual(["password.blocked"]);
    expect(issues("MY-VİRASTACK-ACCOUNT", policy)).toEqual(["password.blocked"]);
    expect(issues("my-v1r4st4ck-account", policy)).toEqual(["password.blocked"]);
    expect(issues("my vira stack account", policy)).toEqual(["password.blocked"]);
    expect(issues("my-other-account-here", policy)).toEqual([]);
  });

  it.each([
    ["0", "o"],
    ["1", "i"],
    ["3", "e"],
    ["4", "a"],
    ["5", "s"],
    ["7", "t"],
    ["8", "b"],
    ["@", "a"],
    ["$", "s"],
    ["!", "i"],
    ["+", "t"],
  ])("reads %s as %s", (leet, letter) => {
    const word = `qz${letter}qz`;
    expect(issues(`long-prefix-qz${leet}qz-x`, definePolicy({ blocklist: [word] }))).toEqual(["password.blocked"]);
  });

  it("normalizes words and drops empty ones", () => {
    expect(policy.blocklist).toEqual(["virastack", "virastackpro"]);
  });
});

describe("forbidden (personal info)", () => {
  const email = "omer.gulcicek92@example.com";

  it("rejects the email's local part and its parts", () => {
    expect(issues("omer.gulcicek92-pass!", nist, [email])).toContain("password.containsPersonalInfo");
    expect(issues("GÜLÇİÇEK-is-my-name", nist, [email])).toContain("password.containsPersonalInfo");
    expect(issues("hello-omer-friend-x", nist, [email])).toContain("password.containsPersonalInfo");
    expect(issues("g0lcicek-in-leetspeak".replace("0", "u"), nist, [email])).toContain("password.containsPersonalInfo");
  });

  it("ignores the domain", () => {
    expect(issues("example-garden-path!", nist, [email])).toEqual([]);
  });

  it("ignores parts shorter than minTokenLength", () => {
    // "92" has 2 characters and is ignored.
    expect(issues("route-92-to-the-coast", nist, [email])).toEqual([]);
  });

  it("checks names, usernames and digit parts", () => {
    expect(issues("ayse-yilmaz-loves-tea", nist, ["Ayşe Yılmaz"])).toContain("password.containsPersonalInfo");
    expect(issues("born-in-1992-somewhere", nist, ["ayse1992@example.com"])).toContain("password.containsPersonalInfo");
    expect(issues("handle-coolcat-rocks", nist, ["@coolcat"])).toContain("password.containsPersonalInfo");
  });

  it("matches Turkish dotless and dotted i both ways", () => {
    expect(issues("isik-gunes-dogan-x", nist, ["Işık"])).toEqual(["password.containsPersonalInfo"]);
    expect(issues("IŞIK-güneş-doğan-x", nist, ["isik"])).toEqual(["password.containsPersonalInfo"]);
    expect(issues("İSTİKLAL-yolu-uzun", nist, ["istiklal"])).toEqual(["password.containsPersonalInfo"]);
  });

  it("ignores non-strings and empty values", () => {
    expect(issues(OK15, nist, [null, undefined, 42, {}, "", "  ", new Blob(["x"])])).toEqual([]);
  });

  it("false positives with 3-character parts, fixed by minTokenLength", () => {
    // "Ali Can" → "ali", "can". "candlelight" contains "can".
    const pw = "candlelight-garden-91";
    expect(issues(pw, nist, ["Ali Can"])).toEqual(["password.containsPersonalInfo"]);
    expect(issues(pw, definePolicy({ minTokenLength: 4 }), ["Ali Can"])).toEqual([]);
    // The full value still counts at 4+: "ali can" is 7 characters.
    expect(issues("ali can is my name ok", definePolicy({ minTokenLength: 4 }), ["Ali Can"])).toEqual([
      "password.containsPersonalInfo",
    ]);
  });

  it("is a hard fail", () => {
    expect(evaluate("omer-gulcicek-garden", nist, { forbidden: [email] }).score).toBe(0);
  });

  it("is skipped for an empty password", () => {
    expect(evaluate("", nist, { forbidden: [email] }).checks.notPersonal).toBe(true);
  });
});

describe("legacy composition rules", () => {
  it("passes a password with all four classes", () => {
    expect(evaluate("Kq7!mzWx", legacy)).toMatchObject({
      valid: true,
      checks: { lowercase: true, uppercase: true, digit: true, symbol: true },
    });
  });

  it("reports each missing class", () => {
    expect(issues("kq7mzwxr", legacy)).toEqual(["password.noUppercase", "password.noSymbol"]);
    expect(issues("KQ7!MZWX", legacy)).toEqual(["password.noLowercase"]);
    expect(issues("Kq!mzWxr", legacy)).toEqual(["password.noDigit"]);
    expect(issues("", legacy)).toEqual([
      "password.tooShort",
      "password.noLowercase",
      "password.noUppercase",
      "password.noDigit",
      "password.noSymbol",
    ]);
  });

  it("is Unicode aware", () => {
    // Ç is an uppercase letter, ٣ (Arabic-Indic three) a digit, a space a symbol.
    expect(issues("Çiçek bahçe٣", legacy)).toEqual([]);
  });

  it("still blocks common passwords", () => {
    expect(issues("Password1!", legacy)).toEqual(["password.common"]);
  });

  it("has no composition checks under nist", () => {
    expect(evaluate(OK15, nist).checks).not.toHaveProperty("uppercase");
  });
});

describe("score", () => {
  it("valid passwords score 2–4, by length and character variety", () => {
    expect(evaluate("kjhqwmzxpvnrtyl", nist)).toMatchObject({ score: 2, level: "fair" });
    expect(evaluate("kjhqwmzxpvnrtylbgdsf", nist)).toMatchObject({ score: 3, level: "good" });
    expect(evaluate("kjhqwmzxpvnrtylbgdsfca", nist)).toMatchObject({ score: 4, level: "strong" });
    expect(evaluate("vu7#Kq2!mz9@Lw4X", nist)).toMatchObject({ score: 4, level: "strong" });
  });

  it("repeated characters add little", () => {
    expect(evaluate("kjhqwmzxkjhqwmzxkjhq", nist).score).toBeLessThan(evaluate("kjhqwmzxpvnrtylbgdsf", nist).score);
  });

  it("failing passwords score 0–1", () => {
    expect(evaluate("kjhqwmzx", nist).score).toBe(1);
    expect(evaluate("kjh", nist).score).toBe(0);
    // Half the minimum length is the line between 0 and 1.
    expect(evaluate("kjhqwmzx", definePolicy({ minLength: 16 })).score).toBe(1);
    expect(evaluate("kjhqwmz", definePolicy({ minLength: 16 })).score).toBe(0);
  });

  it.each([
    ["password", ["password.tooShort", "password.common"]],
    ["aaaaaaaaaaaaaaa", ["password.repetitive"]],
    ["my-acme-account-pw", ["password.blocked"]],
    ["omer-garden-path-91", ["password.containsPersonalInfo"]],
  ])("any severe issue scores 0: %s", (pw, expected) => {
    const result = evaluate(pw, definePolicy({ blocklist: ["acme"] }), { forbidden: ["omer@example.com"] });
    expect(result.issues).toEqual(expected);
    expect(result.score).toBe(0);
  });

  it("each character class widens the pool", () => {
    // 20 digits: 10 symbols in the pool → fair; the same length with letters and digits → strong.
    expect(evaluate("83920174658291037465", nist).score).toBe(2);
    expect(evaluate("kmqxvzwprt" + "kmqxvzwprt".toUpperCase(), nist).score).toBe(4);
    expect(evaluate("kmqxvzwprtbgjhn", nist).score).toBe(2);
    expect(evaluate("k3m9q2x7v4z8w1p6r5t0", nist).score).toBe(4);
    expect(evaluate("kmqxvzwprtbgjhnldfsy", nist).score).toBe(3);
  });

  it("non-strings count as empty", () => {
    expect(evaluate(42 as unknown as string, nist)).toMatchObject({ length: 0, issues: ["password.tooShort"] });
  });
});
