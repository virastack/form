import type React from "react";
import { describe, expectTypeOf, it } from "vitest";
import { getInputAriaAttributes, mergeProps, useViraPassword, type UseViraPasswordResult } from "../src";

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
});
