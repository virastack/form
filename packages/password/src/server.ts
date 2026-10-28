import { evaluate, normalizePassword } from "./strength/core";
import type { EvaluateOptions, PasswordIssue, Policy, StrengthResult } from "./strength/types";

export { definePolicy, evaluate, normalizePassword } from "./strength/core";
export type * from "./strength/types";

export interface ValidatePasswordOptions extends EvaluateOptions {
  /** The repeated password, e.g. `formData.get("confirm")`. Adds `password.mismatch` when it differs. */
  confirm?: unknown;
}

export interface PasswordValidation extends StrengthResult {
  /** No issues, including `password.mismatch`. */
  valid: boolean;
  /** The NFKC-normalized password. Hash this, so the same password typed on another keyboard still verifies. */
  password: string;
}

/**
 * Checks a password on the server with the same policy and engine as the form.
 * Accepts `FormData` values directly; anything that is not a string counts as empty.
 */
export const validatePassword = (
  password: unknown,
  policy: Policy,
  options: ValidatePasswordOptions = {},
): PasswordValidation => {
  const text = typeof password === "string" ? password : "";
  const result = evaluate(text, policy, { forbidden: options.forbidden });
  const issues: PasswordIssue[] = [...result.issues];
  if ("confirm" in options) {
    const confirm = typeof options.confirm === "string" ? options.confirm : "";
    if (normalizePassword(confirm) !== normalizePassword(text)) issues.push("password.mismatch");
  }
  // score and level describe the password; valid covers the confirmation too.
  return { ...result, valid: issues.length === 0, issues, password: normalizePassword(text) };
};
