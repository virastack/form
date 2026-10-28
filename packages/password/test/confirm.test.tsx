import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm, type UseFormReturn } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { mergeProps, useViraPassword, type UseViraPasswordOptions } from "../src";
import { definePolicy } from "../src/strength";

const policy = definePolicy();
const STRONG = "vu7#Kq2!mz9@Lw4X";

const hook = (options: UseViraPasswordOptions) => renderHook(() => useViraPassword(options)).result.current;

describe("matchWith", () => {
  it("is null while the field is empty", () => {
    expect(hook({ matchWith: STRONG, value: "" })).toMatchObject({ matches: null, issues: [] });
    expect(hook({ matchWith: "", value: "" }).matches).toBeNull();
  });

  it("true when equal, false with password.mismatch otherwise", () => {
    expect(hook({ matchWith: STRONG, value: STRONG })).toMatchObject({ matches: true, issues: [] });
    expect(hook({ matchWith: STRONG, value: STRONG.slice(0, -1) })).toMatchObject({
      matches: false,
      issues: ["password.mismatch"],
    });
    expect(hook({ matchWith: "", value: "x" }).matches).toBe(false);
  });

  it("is case and whitespace sensitive", () => {
    expect(hook({ matchWith: "Secret", value: "secret" }).matches).toBe(false);
    expect(hook({ matchWith: "secret ", value: "secret" }).matches).toBe(false);
  });

  it("matches the same text typed in NFC and NFD", () => {
    const nfc = "şifre-çiçek-é".normalize("NFC");
    expect(hook({ matchWith: nfc, value: nfc.normalize("NFD") }).matches).toBe(true);
  });

  it("is null without matchWith", () => {
    expect(hook({ value: "x" }).matches).toBeNull();
  });

  it("defaults autoComplete to new-password", () => {
    expect(hook({ matchWith: "" }).inputProps.autoComplete).toBe("new-password");
  });

  it("follows typing and changes of matchWith", async () => {
    function Confirm({ password }: { password: string }) {
      const confirm = useViraPassword({ matchWith: password });
      return (
        <>
          <input aria-label="Confirm" {...confirm.inputProps} />
          <p data-testid="matches">{String(confirm.matches)}</p>
        </>
      );
    }
    const { rerender } = render(<Confirm password="abc" />);
    const matches = () => screen.getByTestId("matches").textContent;
    expect(matches()).toBe("null");
    await userEvent.type(screen.getByLabelText("Confirm"), "abc");
    expect(matches()).toBe("true");
    rerender(<Confirm password="abcd" />);
    expect(matches()).toBe("false");
  });

  it("puts policy issues before the mismatch", () => {
    expect(hook({ policy, matchWith: "x", value: "short" }).issues).toEqual(["password.tooShort", "password.mismatch"]);
  });
});

describe("rule", () => {
  it("compares with the latest matchWith and stays stable", () => {
    const { result, rerender } = renderHook((options: UseViraPasswordOptions) => useViraPassword(options), {
      initialProps: { matchWith: "one" } as UseViraPasswordOptions,
    });
    const rule = result.current.rule;
    expect(rule.validate("one")).toBe(true);
    expect(rule.validate("two")).toBe("password.mismatch");
    rerender({ matchWith: "two" });
    expect(result.current.rule).toBe(rule);
    expect(rule.validate("two")).toBe(true);
  });

  it("empty against empty passes; empty against a password fails", () => {
    expect(hook({ matchWith: "" }).rule.validate("")).toBe(true);
    expect(hook({ matchWith: "secret" }).rule.validate("")).toBe("password.mismatch");
    expect(hook({ matchWith: "secret" }).rule.validate(undefined)).toBe("password.mismatch");
  });

  it("checks the policy first", () => {
    expect(hook({ policy, matchWith: "abc" }).rule.validate("abc")).toBe("password.tooShort");
  });
});

describe("two fields", () => {
  it("have independent toggles", async () => {
    function Pair() {
      const pw = useViraPassword({ id: "pw" });
      const confirm = useViraPassword({ id: "confirm", matchWith: "" });
      return (
        <>
          <input aria-label="Password" {...pw.inputProps} />
          <button {...pw.btnProps} aria-label="Toggle password" />
          <input aria-label="Confirm" {...confirm.inputProps} />
          <button {...confirm.btnProps} aria-label="Toggle confirm" />
        </>
      );
    }
    render(<Pair />);
    await userEvent.click(screen.getByRole("button", { name: "Toggle password" }));
    expect((screen.getByLabelText("Password") as HTMLInputElement).type).toBe("text");
    expect((screen.getByLabelText("Confirm") as HTMLInputElement).type).toBe("password");
  });
});

type Values = { password: string; confirm: string };

describe("React Hook Form", () => {
  function Signup({ onForm }: { onForm: (form: UseFormReturn<Values>) => void }) {
    const form = useForm<Values>({ defaultValues: { password: "", confirm: "" }, mode: "onChange" });
    onForm(form);
    const password = form.watch("password");
    const pw = useViraPassword({ policy, value: password });
    const confirm = useViraPassword({ matchWith: password, value: form.watch("confirm") });
    return (
      <form onSubmit={form.handleSubmit(() => {})}>
        {/* deps re-validates confirm when the password changes */}
        <input aria-label="Password" {...mergeProps(pw.inputProps, form.register("password", { ...pw.rule, deps: ["confirm"] }))} />
        <input aria-label="Confirm" {...mergeProps(confirm.inputProps, form.register("confirm", confirm.rule))} />
        <p data-testid="matches">{String(confirm.matches)}</p>
        <p role="alert">{form.formState.errors.confirm?.message}</p>
      </form>
    );
  }

  it("validates, re-validates on password change, and follows reset() and setValue()", async () => {
    let form!: UseFormReturn<Values>;
    render(<Signup onForm={(f) => (form = f)} />);
    const matches = () => screen.getByTestId("matches").textContent;
    const alert = () => screen.getByRole("alert");

    await userEvent.type(screen.getByLabelText("Password"), STRONG);
    await userEvent.type(screen.getByLabelText("Confirm"), STRONG.slice(0, 5));
    await waitFor(() => expect(alert()).toHaveTextContent("password.mismatch"));
    expect(matches()).toBe("false");

    await userEvent.type(screen.getByLabelText("Confirm"), STRONG.slice(5));
    await waitFor(() => expect(alert()).toHaveTextContent(""));
    expect(matches()).toBe("true");

    // Changing the password makes the confirm field wrong again.
    await userEvent.type(screen.getByLabelText("Password"), "!");
    await waitFor(() => expect(alert()).toHaveTextContent("password.mismatch"));
    expect(matches()).toBe("false");

    act(() => form.setValue("confirm", `${STRONG}!`, { shouldValidate: true }));
    await waitFor(() => expect(alert()).toHaveTextContent(""));
    expect(matches()).toBe("true");

    act(() => form.reset());
    expect(matches()).toBe("null");
    expect((screen.getByLabelText("Confirm") as HTMLInputElement).value).toBe("");
  });
});
