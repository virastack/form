import type React from "react";
import { describe, expectTypeOf, it } from "vitest";
import { getInputAriaAttributes, mergeProps, useViraPassword, type UseViraPasswordResult } from "../src";
import { useForm } from "react-hook-form";
import { useViraPasswordForm } from "../src/form";
import { checkPwned, type PwnedResult } from "../src/pwned";
import { validatePassword, type PasswordValidation } from "../src/server";
import { definePolicy, evaluate, type PasswordIssue, type Policy, type StrengthResult } from "../src/strength";

describe("types", () => {
  it("returns no any", () => {
    const pw = useViraPassword();
    expectTypeOf(pw).toEqualTypeOf<UseViraPasswordResult>();
    expectTypeOf(pw.inputProps).not.toBeAny();
    expectTypeOf(pw.btnProps).not.toBeAny();
    expectTypeOf(pw.isVisible).toEqualTypeOf<boolean>();
    expectTypeOf(pw.capsLock).toEqualTypeOf<boolean>();
    expectTypeOf(pw.inputProps.ref).toEqualTypeOf<React.Ref<HTMLInputElement> | undefined>();
  });

  it("accepts register()-style input props", () => {
    const register = { name: "password", onChange: async () => true, onBlur: async () => true, ref: (_: HTMLInputElement | null) => {} };
    useViraPassword({ inputProps: register, autoComplete: "new-password" });
    useViraPassword({ autoComplete: false, visible: true, onVisibleChange: (v) => expectTypeOf(v).toEqualTypeOf<boolean>() });
    // @ts-expect-error autoComplete is a string or false
    useViraPassword({ autoComplete: true });
  });

  it("helpers are typed", () => {
    expectTypeOf(getInputAriaAttributes(true)).toEqualTypeOf<{ "aria-invalid"?: boolean; "aria-describedby"?: string }>();
    expectTypeOf(mergeProps({ id: "a" }, { id: "b" })).toEqualTypeOf<{ id: string }>();
  });

  it("strength types", () => {
    const policy = definePolicy({ preset: "legacy", require: { symbol: false } });
    expectTypeOf(policy).toEqualTypeOf<Policy>();
    const result = evaluate("x", policy, { forbidden: ["a@b.co", null] });
    expectTypeOf(result).toEqualTypeOf<StrengthResult>();
    expectTypeOf(result.score).toEqualTypeOf<0 | 1 | 2 | 3 | 4>();
    expectTypeOf(result.level).toEqualTypeOf<"weak" | "fair" | "good" | "strong">();
    expectTypeOf(result.issues).toEqualTypeOf<PasswordIssue[]>();
    expectTypeOf<"password.tooShort">().toExtend<PasswordIssue>();
    // @ts-expect-error unknown preset
    definePolicy({ preset: "strict" });
    // @ts-expect-error policy is required
    evaluate("x");
  });

  it("hook strength fields", () => {
    const pw = useViraPassword({ policy: definePolicy(), forbidden: ["a"], value: "x" });
    expectTypeOf(pw.strength).toEqualTypeOf<StrengthResult | null>();
    expectTypeOf(pw.issues).toEqualTypeOf<PasswordIssue[]>();
    expectTypeOf(pw.rule.validate).returns.toEqualTypeOf<true | PasswordIssue>();
    expectTypeOf(pw.strengthProps.role).toEqualTypeOf<"status">();
    expectTypeOf(pw.matches).toEqualTypeOf<boolean | null>();
    useViraPassword({ matchWith: "x" });
    // @ts-expect-error matchWith is a string
    useViraPassword({ matchWith: 1 });
  });

  it("mergeProps combines two prop types", () => {
    const pw = useViraPassword();
    const register = { name: "password", onChange: async (_: unknown) => true, ref: (_: HTMLInputElement | null) => {} };
    const merged = mergeProps(pw.inputProps, register);
    expectTypeOf(merged.name).toEqualTypeOf<string>();
    expectTypeOf(merged.type).toEqualTypeOf<React.HTMLInputTypeAttribute | undefined>();
  });

  it("server types", () => {
    const form = new FormData();
    const result = validatePassword(form.get("password"), definePolicy(), { forbidden: [form.get("email")], confirm: form.get("confirm") });
    expectTypeOf(result).toEqualTypeOf<PasswordValidation>();
    expectTypeOf(result.password).toEqualTypeOf<string>();
    // @ts-expect-error policy is required
    validatePassword("x");
  });

  it("pwned types", async () => {
    const result = await checkPwned("x", { signal: AbortSignal.timeout(1000), timeout: 2000 });
    expectTypeOf(result).toEqualTypeOf<PwnedResult>();
    if (result.status === "pwned") expectTypeOf(result.count).toEqualTypeOf<number>();
    if (result.status === "unknown") expectTypeOf(result.reason).toExtend<string>();
  });

  it("validatePassword returns a Promise only with pwned", () => {
    const policy = definePolicy();
    expectTypeOf(validatePassword("x", policy, { pwned: true })).toEqualTypeOf<Promise<PasswordValidation>>();
    expectTypeOf(validatePassword("x", policy, { pwned: { timeout: 1000 } })).toEqualTypeOf<Promise<PasswordValidation>>();
    expectTypeOf(validatePassword("x", policy, { pwned: false })).toEqualTypeOf<PasswordValidation>();
    const maybe: boolean = Math.random() > 0.5;
    expectTypeOf(validatePassword("x", policy, { pwned: maybe })).toEqualTypeOf<PasswordValidation | Promise<PasswordValidation>>();
  });

  it("useViraPasswordForm checks field names and types confirm", () => {
    const form = useForm<{ email: string; password: string; confirm: string }>();
    const withConfirm = useViraPasswordForm(form, { name: "password", confirm: "confirm", forbidden: ["email"] });
    expectTypeOf(withConfirm.confirm).toEqualTypeOf<UseViraPasswordResult>();
    const without = useViraPasswordForm(form, { name: "password" });
    expectTypeOf(without.confirm).toEqualTypeOf<null>();
    // @ts-expect-error not a field
    useViraPasswordForm(form, { name: "pasword" });
    // @ts-expect-error not a field
    useViraPasswordForm(form, { name: "password", forbidden: ["mail"] });
  });

  it("policy presets", () => {
    definePolicy({ preset: "mfa", normalization: "NFC" });
    // @ts-expect-error unknown preset
    definePolicy({ preset: "strict" });
  });
});
