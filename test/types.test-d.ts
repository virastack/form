import { describe, expectTypeOf, it } from "vitest";
import { getInputAriaAttributes, mergeProps, useViraPassword, type UseViraPasswordResult } from "../src";

describe("types", () => {
  it("returns no any", () => {
    const pw = useViraPassword();
    expectTypeOf(pw).toEqualTypeOf<UseViraPasswordResult>();
    expectTypeOf(pw.inputProps).not.toBeAny();
    expectTypeOf(pw.btnProps).not.toBeAny();
    expectTypeOf(pw.isVisible).toEqualTypeOf<boolean>();
  });

  it("helpers are typed", () => {
    expectTypeOf(getInputAriaAttributes(true)).toEqualTypeOf<{ "aria-invalid"?: boolean; "aria-describedby"?: string }>();
    expectTypeOf(mergeProps({ id: "a" }, { id: "b" })).toEqualTypeOf<{ id: string }>();
  });
});
