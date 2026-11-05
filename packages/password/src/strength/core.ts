import { COMMON } from "./common";
import type {
  EvaluateOptions,
  Normalization,
  PasswordChecks,
  PasswordIssue,
  Policy,
  PolicyOptions,
  StrengthLevel,
  StrengthResult,
  StrengthScore,
} from "./types";

const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g;
const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s", "!": "i", "+": "t" };
// Rows and runs that read as a sequence when typed, forwards or backwards.
const SEQUENCES = [
  "abcdefghijklmnopqrstuvwxyz",
  "0123456789",
  "qwertyuiopasdfghjklzxcvbnm",
  "qwertzuiopasdfghjklyxcvbnm",
  "azertyuiopqsdfghjklmwxcvbn",
  // Turkish Q layout, folded: ı→i, ğ→g, ü→u, ş→s, ö→o, ç→c
  "qwertyuiopguasdfghjklsizxcvbnmoc",
  "1qaz2wsx3edc4rfv5tgb6yhn7ujm8ik9ol0p",
];
const LEVELS: readonly StrengthLevel[] = ["weak", "weak", "fair", "good", "strong"];

let common: Set<string> | undefined;

/**
 * NFKC by default, so visually identical input from different keyboards (full-width, ligatures)
 * compares and hashes the same. Pass `"NFC"` for NIST SP 800-63B-4's recommendation.
 */
export const normalizePassword = (password: string, form: Normalization = "NFKC"): string =>
  password.normalize(form);

const codePoints = (value: string): string[] => Array.from(value.replace(ZERO_WIDTH, ""));

/** Lowercase without accents, for comparisons only: "Şifre" and "sifre" match, so do "İ" and "i". */
const fold = (value: string): string =>
  value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/\u0131/g, "i").replace(ZERO_WIDTH, "");

const deLeet = (value: string): string => value.replace(/[0-9@$!+]/g, (c) => LEET[c] ?? c);

/** Length of the shortest unit the string repeats, e.g. 3 for "abcabcab" (the last copy may be cut short). */
const period = (value: string[]): number => {
  const n = value.length;
  const lps = new Array<number>(n).fill(0);
  for (let i = 1, k = 0; i < n; i++) {
    while (k > 0 && value[i] !== value[k]) k = lps[k - 1];
    if (value[i] === value[k]) k++;
    lps[i] = k;
  }
  return n - (lps[n - 1] ?? 0);
};

const unit = (value: string): string => {
  const chars = Array.from(value);
  return chars.slice(0, period(chars)).join("");
};

/**
 * What the whole password reduces to: "P@ssw0rd2024!" → "password", "summer2024summer" → "summer",
 * "ali1990" → "ali". Digits inside are leetspeak or separators. Used for every list check, so a
 * password is compared as a whole (NIST SP 800-63B-4), never searched for words it contains.
 */
const cores = (folded: string): string[] => {
  // Digits after the last letter are a suffix ("ali1990"), not leetspeak; the ones before may be ("4li").
  const trimmed = folded.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
  const bases = [
    deLeet(folded.replace(/[^\p{L}]+$/u, "")).replace(/[^\p{L}]/gu, ""),
    deLeet(trimmed).replace(/[^\p{L}]/gu, ""),
    trimmed.replace(/[^\p{L}]/gu, ""),
    folded.replace(/[^\p{L}\p{N}]/gu, ""),
  ];
  // Both the base and its repeating unit: "summersummer" → "summer", while "salsa" stays "salsa"
  // although its unit is "sal".
  return [...new Set(bases.flatMap((base) => [base, unit(base)]))].filter(Boolean);
};

const isSequence = (folded: string): boolean => {
  if (folded.length < 3) return false;
  return SEQUENCES.some((sequence) => {
    const forward = sequence.repeat(Math.ceil(folded.length / sequence.length) + 1);
    const backward = Array.from(forward).reverse().join("");
    return forward.includes(folded) || backward.includes(folded);
  });
};

const isRepetitive = (chars: string[], folded: string): boolean => {
  // Fewer than 4 distinct characters; short inputs need half of theirs.
  if (new Set(chars).size < Math.min(4, Math.ceil(chars.length / 2))) return true;
  if (period(chars) <= chars.length / 3) return true;
  // Runs of one character: "aaaabbbbccccdddd" is "abcd" typed slowly.
  const runs = chars.filter((char, i) => char !== chars[i - 1]);
  if (runs.length <= chars.length / 2) return true;
  return isSequence(folded);
};

/** Splits emails (local part only), names and usernames into lowercase parts, separators removed. */
export const personalTokens = (forbidden: readonly unknown[], minTokenLength: number): string[] => {
  const tokens = new Set<string>();
  for (const value of forbidden) {
    if (typeof value !== "string") continue;
    const at = value.lastIndexOf("@");
    const source = fold(at > 0 ? value.slice(0, at) : value).trim();
    const parts = [
      source.replace(/[^\p{L}\p{N}]/gu, ""),
      source.replace(/[^\p{L}]/gu, ""),
      ...source.split(/[^\p{L}\p{N}]+|(?<=\p{L})(?=\p{N})|(?<=\p{N})(?=\p{L})/u),
    ];
    for (const part of parts) {
      if (Array.from(part).length >= minTokenLength) tokens.add(part);
    }
  }
  return [...tokens];
};

const matchesAny = (passwordCores: readonly string[], words: readonly string[]): boolean =>
  words.length > 0 && passwordCores.some((core) => words.includes(core));

const scoreFor = (chars: string[], issues: PasswordIssue[], minLength: number): StrengthScore => {
  if (chars.length === 0) return 0;
  if (issues.length > 0) {
    const severe = issues.some((issue) =>
      ["password.common", "password.blocked", "password.repetitive", "password.containsPersonalInfo"].includes(issue),
    );
    return severe || chars.length < minLength / 2 ? 0 : 1;
  }
  // Length past the minimum, never character classes: NIST SP 800-63B-4 drops composition rules,
  // so an uppercase letter or a digit must not buy a better level. Repeated characters add little;
  // each distinct one counts at most twice.
  const effective = Math.min(chars.length, new Set(chars).size * 2);
  const extra = effective - minLength;
  return extra >= 10 ? 4 : extra >= 5 ? 3 : 2;
};

const evaluateWith = (policy: Policy, input: unknown, options: EvaluateOptions = {}): StrengthResult => {
  const password = typeof input === "string" ? normalizePassword(input, policy.normalization) : "";
  const chars = codePoints(password);
  const folded = fold(password);
  const { require } = policy;
  const issues: PasswordIssue[] = [];
  const checks: PasswordChecks = {
    minLength: chars.length >= policy.minLength,
    maxLength: chars.length <= policy.maxLength,
    notCommon: true,
    notBlocked: true,
    notRepetitive: true,
    notPersonal: true,
  };

  if (!checks.minLength) issues.push("password.tooShort");
  if (!checks.maxLength) issues.push("password.tooLong");

  if (require.lowercase) checks.lowercase = /\p{Ll}/u.test(password);
  if (require.uppercase) checks.uppercase = /\p{Lu}/u.test(password);
  if (require.digit) checks.digit = /\p{Nd}/u.test(password);
  if (require.symbol) checks.symbol = /[^\p{L}\p{N}]/u.test(password);
  if (checks.lowercase === false) issues.push("password.noLowercase");
  if (checks.uppercase === false) issues.push("password.noUppercase");
  if (checks.digit === false) issues.push("password.noDigit");
  if (checks.symbol === false) issues.push("password.noSymbol");

  // Far past the limit the answer is "too long" anyway; skip the pattern checks on huge input.
  const huge = password.length > policy.maxLength * 4;
  const passwordCores = huge ? [] : cores(folded);
  if (chars.length >= 4 && !huge) {
    if (policy.blockCommon) {
      const list = (common ??= new Set(COMMON.split(" ")));
      checks.notCommon = !passwordCores.some((core) => list.has(core));
    }
    checks.notBlocked = !matchesAny(passwordCores, policy.blocklist);
    if (policy.blockRepetitive) checks.notRepetitive = !isRepetitive(Array.from(folded), folded);
  }
  if (chars.length > 0 && options.forbidden && !huge) {
    checks.notPersonal = !matchesAny(passwordCores, personalTokens(options.forbidden, policy.minTokenLength));
  }

  if (!checks.notCommon) issues.push("password.common");
  if (!checks.notBlocked) issues.push("password.blocked");
  if (!checks.notRepetitive) issues.push("password.repetitive");
  if (!checks.notPersonal) issues.push("password.containsPersonalInfo");

  const score = scoreFor(chars, issues, policy.minLength);
  return { score, level: LEVELS[score], length: chars.length, valid: issues.length === 0, checks, issues };
};

const PRESETS = {
  nist: { minLength: 15, maxLength: 64, require: {} },
  // NIST SP 800-63B-4: 8 characters are enough when the password is one factor of several.
  mfa: { minLength: 8, maxLength: 64, require: {} },
  legacy: { minLength: 8, maxLength: 64, require: { lowercase: true, uppercase: true, digit: true, symbol: true } },
} as const;

const assertLength = (name: string, value: number) => {
  if (!Number.isInteger(value) || value < 1) throw new RangeError(`definePolicy: ${name} must be a positive integer, got ${value}`);
};

/** A password policy. Define it once in a shared module and use it in the form and on the server. */
export const definePolicy = (options: PolicyOptions = {}): Policy => {
  const preset = options.preset ?? "nist";
  const base = PRESETS[preset];
  if (!base) throw new RangeError(`definePolicy: unknown preset "${String(preset)}"`);
  const minLength = options.minLength ?? base.minLength;
  const maxLength = options.maxLength ?? base.maxLength;
  const minTokenLength = options.minTokenLength ?? 3;
  const normalization = options.normalization ?? "NFKC";
  if (normalization !== "NFKC" && normalization !== "NFC") {
    throw new RangeError(`definePolicy: normalization must be "NFKC" or "NFC", got "${String(normalization)}"`);
  }
  assertLength("minLength", minLength);
  assertLength("maxLength", maxLength);
  assertLength("minTokenLength", minTokenLength);
  if (minLength > maxLength) throw new RangeError(`definePolicy: minLength (${minLength}) is greater than maxLength (${maxLength})`);
  const req = { ...base.require, ...options.require };
  const require = {
    lowercase: req.lowercase === true,
    uppercase: req.uppercase === true,
    digit: req.digit === true,
    symbol: req.symbol === true,
  };
  const classes = Object.values(require).filter(Boolean).length;
  if (classes > maxLength) throw new RangeError(`definePolicy: ${classes} required character classes do not fit in maxLength (${maxLength})`);

  const policy: Policy = Object.freeze({
    preset,
    minLength,
    maxLength,
    require: Object.freeze(require),
    blockCommon: options.blockCommon ?? true,
    blockRepetitive: options.blockRepetitive ?? true,
    blocklist: Object.freeze((options.blocklist ?? []).map((word) => fold(word).replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean)),
    minTokenLength,
    normalization,
    evaluate: (password: string, evaluateOptions?: EvaluateOptions) => evaluateWith(policy, password, evaluateOptions),
  });
  return policy;
};

/** Scores a password against a policy. Pure; no UI. */
export const evaluate = (password: string, policy: Policy, options?: EvaluateOptions): StrengthResult =>
  policy.evaluate(password, options);
