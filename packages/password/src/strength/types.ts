/** Error keys. Map them to messages in your own i18n. */
export type PasswordIssue =
  | "password.tooShort"
  | "password.tooLong"
  | "password.noLowercase"
  | "password.noUppercase"
  | "password.noDigit"
  | "password.noSymbol"
  | "password.common"
  | "password.blocked"
  | "password.repetitive"
  | "password.containsPersonalInfo"
  | "password.mismatch"
  | "password.pwned";

export type StrengthScore = 0 | 1 | 2 | 3 | 4;
export type StrengthLevel = "weak" | "fair" | "good" | "strong";

export interface PasswordChecks {
  minLength: boolean;
  maxLength: boolean;
  notCommon: boolean;
  notBlocked: boolean;
  notRepetitive: boolean;
  notPersonal: boolean;
  /** Only present when the policy requires the character class. */
  lowercase?: boolean;
  uppercase?: boolean;
  digit?: boolean;
  symbol?: boolean;
}

export interface StrengthResult {
  /** 0–1 fail the policy, 2–4 pass it. */
  score: StrengthScore;
  level: StrengthLevel;
  /** Characters (Unicode code points) after normalization, without zero-width characters. */
  length: number;
  /** No issues. */
  valid: boolean;
  checks: PasswordChecks;
  issues: PasswordIssue[];
}

export interface EvaluateOptions {
  /**
   * The user's email, name or username. The password must not be one of them or a part of them,
   * compared as a whole like `blocklist`: "ali1990" fails for "Ali Can", "kaliteli-sabah-kahvesi" passes.
   * Non-strings are ignored.
   */
  forbidden?: readonly unknown[];
}

export interface CharacterRequirements {
  lowercase?: boolean;
  uppercase?: boolean;
  digit?: boolean;
  symbol?: boolean;
}

/**
 * `nist`: 15–64 characters, the password is the only factor.
 * `mfa`: 8–64 characters, the password is used with a second factor (NIST SP 800-63B-4).
 * `legacy`: 8–64 characters and all four character classes.
 * @deprecated `legacy` goes against NIST SP 800-63B-4; use `require` if you must keep composition rules.
 */
export type PolicyPreset = "nist" | "mfa" | "legacy";

/** Unicode normalization applied before checking, comparing and hashing. */
export type Normalization = "NFKC" | "NFC";

export interface PolicyOptions {
  /**
   * `nist` (default): 15–64 characters, no composition rules. `mfa`: 8–64 characters, for a password
   * used with a second factor. `legacy` (deprecated): 8–64 characters, all four classes.
   */
  preset?: PolicyPreset;
  minLength?: number;
  maxLength?: number;
  /** Composition rules. Not recommended by NIST SP 800-63B-4. */
  require?: CharacterRequirements;
  /** Reject common passwords from the built-in list. @default true */
  blockCommon?: boolean;
  /** Reject repeated characters and sequences like `aaaa…` or `12345…`. @default true */
  blockRepetitive?: boolean;
  /**
   * Words the password must not be, e.g. your product name. The whole password is compared after
   * removing digits, symbols, leetspeak and repetition, so "Acme2024!" matches "acme" and
   * "acme-insurance-club" does not. Case and accents are ignored.
   */
  blocklist?: readonly string[];
  /** Parts of `forbidden` values shorter than this are ignored. @default 3 */
  minTokenLength?: number;
  /**
   * `NFKC` (default) also folds full-width letters and ligatures; `NFC`, which NIST SP 800-63B-4
   * recommends, keeps them. Changing it changes the normalized password you hash.
   * @default "NFKC"
   */
  normalization?: Normalization;
}

export interface Policy {
  readonly preset: PolicyPreset;
  readonly minLength: number;
  readonly maxLength: number;
  readonly require: Readonly<Required<CharacterRequirements>>;
  readonly blockCommon: boolean;
  readonly blockRepetitive: boolean;
  readonly blocklist: readonly string[];
  readonly minTokenLength: number;
  readonly normalization: Normalization;
  /** The engine travels with the policy, so the hook does not import it. */
  readonly evaluate: (password: string, options?: EvaluateOptions) => StrengthResult;
}
