import { checkPwned, type CheckPwnedOptions, type PwnedResult } from "./pwned";
import { evaluate, normalizePassword } from "./strength/core";
import type { EvaluateOptions, PasswordIssue, Policy, StrengthResult } from "./strength/types";

export { definePolicy, evaluate, normalizePassword } from "./strength/core";
export type * from "./strength/types";
export type { CheckPwnedOptions, PwnedResult } from "./pwned";

export interface ValidatePasswordOptions extends EvaluateOptions {
  /** The repeated password, e.g. `formData.get("confirm")`. Adds `password.mismatch` when it differs. */
  confirm?: unknown;
  /**
   * Also look the password up in Have I Been Pwned (k-anonymity), only when it passes the policy.
   * `true` or `checkPwned` options. Makes `validatePassword` return a Promise. A failed lookup
   * never blocks: `pwned.status` is `unknown` and the result stays valid.
   */
  pwned?: boolean | CheckPwnedOptions;
}

export interface PasswordValidation extends StrengthResult {
  /** No issues, including `password.mismatch` and `password.pwned`. */
  valid: boolean;
  /** The password normalized with the policy's `normalization` (NFKC by default). Hash this. */
  password: string;
  /** With the `pwned` option: the lookup result; missing when the policy already failed. */
  pwned?: PwnedResult;
}

const validateSync = (password: unknown, policy: Policy, options: ValidatePasswordOptions): PasswordValidation => {
  const text = typeof password === "string" ? password : "";
  const result = evaluate(text, policy, { forbidden: options.forbidden });
  const issues: PasswordIssue[] = [...result.issues];
  if ("confirm" in options) {
    const confirm = typeof options.confirm === "string" ? options.confirm : "";
    if (normalizePassword(confirm, policy.normalization) !== normalizePassword(text, policy.normalization)) {
      issues.push("password.mismatch");
    }
  }
  // score and level describe the password; valid covers the confirmation too.
  return { ...result, valid: issues.length === 0, issues, password: normalizePassword(text, policy.normalization) };
};

const withPwned = async (validation: PasswordValidation, lookup: CheckPwnedOptions): Promise<PasswordValidation> => {
  // A password that already fails the policy is rejected anyway; skip the request.
  if (validation.issues.some((issue) => issue !== "password.mismatch")) return validation;
  const pwned = await checkPwned(validation.password, lookup);
  if (pwned.status !== "pwned") return { ...validation, pwned };
  return {
    ...validation,
    pwned,
    score: 0,
    level: "weak",
    valid: false,
    issues: [...validation.issues, "password.pwned"],
  };
};

/**
 * Checks a password on the server with the same policy and engine as the form.
 * Accepts `FormData` values directly; anything that is not a string counts as empty.
 */
export function validatePassword(
  password: unknown,
  policy: Policy,
  options: ValidatePasswordOptions & { pwned: true | CheckPwnedOptions },
): Promise<PasswordValidation>;
export function validatePassword(
  password: unknown,
  policy: Policy,
  options?: ValidatePasswordOptions & { pwned?: false },
): PasswordValidation;
export function validatePassword(
  password: unknown,
  policy: Policy,
  options?: ValidatePasswordOptions,
): PasswordValidation | Promise<PasswordValidation>;
export function validatePassword(
  password: unknown,
  policy: Policy,
  options: ValidatePasswordOptions = {},
): PasswordValidation | Promise<PasswordValidation> {
  const validation = validateSync(password, policy, options);
  if (!options.pwned) return validation;
  return withPwned(validation, options.pwned === true ? {} : options.pwned);
}
