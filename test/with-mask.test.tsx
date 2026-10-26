// Phone (@virastack/mask v2) + password + confirm in one React Hook Form.
// Runs when ../mask exists (mask v2 is not published yet); skipped otherwise, e.g. in CI.
// vitest.config.mts points "@virastack/mask" at ../mask/src; test/mask.d.ts types the part used here.
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm, type UseFormReturn } from "react-hook-form";
import { useViraMask } from "@virastack/mask";
import { describe, expect, it } from "vitest";
import { mergeProps, useViraPassword } from "../src";
import { definePolicy } from "../src/strength";

type Values = { phone: string; password: string; confirm: string };

const policy = definePolicy();
const STRONG = "vu7#Kq2!mz9@Lw4X";

describe.skipIf(!process.env.VIRASTACK_MASK)("with @virastack/mask v2", () => {
  let form!: UseFormReturn<Values>;
  function Signup() {
    form = useForm<Values>({ defaultValues: { phone: "", password: "", confirm: "" }, mode: "onChange" });
    const { phone } = useViraMask(form, { phone: { preset: "phone", country: "TR" } });
    const password = form.watch("password");
    const pw = useViraPassword({ policy, value: password });
    const confirm = useViraPassword({ matchWith: password, value: form.watch("confirm") });
    return (
      <form>
        <input aria-label="Phone" {...phone} />
        <input aria-label="Password" {...mergeProps(pw.inputProps, form.register("password", { ...pw.rule, deps: ["confirm"] }))} />
        <button {...pw.btnProps} />
        <p {...pw.strengthProps}>{pw.strength?.level}</p>
        <input aria-label="Confirm" {...mergeProps(confirm.inputProps, form.register("confirm", confirm.rule))} />
        <p data-testid="matches">{String(confirm.matches)}</p>
        <p role="alert">{form.formState.errors.confirm?.message}</p>
      </form>
    );
  }

  const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

  it("share one form; reset() and setValue() keep both right", async () => {
    render(<Signup />);
    await userEvent.type(input("Phone"), "05551234567");
    await userEvent.type(input("Password"), STRONG);
    await userEvent.type(input("Confirm"), STRONG);
    expect(input("Phone").value).toBe("(555) 123 45 67");
    expect(form.getValues()).toEqual({ phone: "5551234567", password: STRONG, confirm: STRONG });
    expect(screen.getByRole("status")).toHaveTextContent("strong");
    expect(screen.getByTestId("matches")).toHaveTextContent("true");

    act(() => {
      form.setValue("phone", "5321112233");
      form.setValue("password", "short", { shouldValidate: true });
    });
    expect(input("Phone").value).toBe("(532) 111 22 33");
    expect(input("Password").value).toBe("short");
    expect(screen.getByRole("status")).toHaveTextContent("weak");
    expect(screen.getByTestId("matches")).toHaveTextContent("false");
    // deps only runs on user input; after setValue() trigger the confirm field yourself.
    await act(() => form.trigger("confirm"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("password.mismatch"));

    act(() => form.reset({ phone: "5551234567", password: STRONG, confirm: STRONG }));
    expect(input("Phone").value).toBe("(555) 123 45 67");
    expect(input("Password").value).toBe(STRONG);
    expect(screen.getByRole("status")).toHaveTextContent("strong");
    expect(screen.getByTestId("matches")).toHaveTextContent("true");

    act(() => form.reset({ phone: "", password: "", confirm: "" }));
    expect(input("Phone").value).toBe("");
    expect(input("Password").value).toBe("");
    expect(screen.getByTestId("matches")).toHaveTextContent("null");
  });

  it("a masked PIN with its own toggle: mask first, inputProps after (the mask docs pattern)", async () => {
    let pinForm!: UseFormReturn<{ pin: string }>;
    function Pin() {
      pinForm = useForm<{ pin: string }>({ defaultValues: { pin: "" } });
      const { pin } = useViraMask(pinForm, { pin: { mask: "999999" } });
      const pw = useViraPassword({ id: "pin" });
      return <input aria-label="PIN" {...pin} {...pw.inputProps} />;
    }
    render(<Pin />);
    await userEvent.type(input("PIN"), "12ab3456789");
    // The mask still owns the value: digits only, six of them.
    expect(input("PIN").value).toBe("123456");
    expect(pinForm.getValues("pin")).toBe("123456");
    expect(input("PIN").type).toBe("password");
  });
});
