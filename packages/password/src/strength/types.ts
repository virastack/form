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
  | "password.mismatch";

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
  /** Characters (Unicode code points) after NFKC normalization, without zero-width characters. */
  length: number;
  /** No issues. */
  valid: boolean;
  checks: PasswordChecks;
  issues: PasswordIssue[];
}

export interface EvaluateOptions {
  /** Values the password must not contain, e.g. the user's email and name. Non-strings are ignored. */
  forbidden?: readonly unknown[];
}

export interface CharacterRequirements {
  lowercase?: boolean;
  uppercase?: boolean;
  digit?: boolean;
  symbol?: boolean;
}

export type PolicyPreset = "nist" | "legacy";

export interface PolicyOptions {
  /** `nist` (default): 15–64 characters, no composition rules. `legacy`: 8–64 characters, all four classes. */
  preset?: PolicyPreset;
  minLength?: number;
  maxLength?: number;
  /** Composition rules. Not recommended by NIST SP 800-63B-4. */
  require?: CharacterRequirements;
  /** Reject common passwords from the built-in list. @default true */
  blockCommon?: boolean;
  /** Reject repeated characters and sequences like `aaaa…` or `12345…`. @default true */
  blockRepetitive?: boolean;
  /** Words the password must not contain, e.g. your product name. Case and accents are ignored. */
  blocklist?: readonly string[];
  /** Parts of `forbidden` values shorter than this are ignored. @default 3 */
  minTokenLength?: number;
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
  /** The engine travels with the policy, so the hook does not import it. */
  readonly evaluate: (password: string, options?: EvaluateOptions) => StrengthResult;
}
