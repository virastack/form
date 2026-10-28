// One test per v1 bug, so none of them comes back.
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm, type UseFormReturn } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { createMask, useViraMask } from "../src";
import { parseMasked } from "../src/server";

function PhoneForm({ onForm }: { onForm?: (form: UseFormReturn<{ phone: string }>) => void }) {
  const form = useForm<{ phone: string }>();
  onForm?.(form);
  const { phone } = useViraMask(form, { phone: { preset: "phone", country: "TR" } });
  return (
    <>
      <input aria-label="phone" {...phone} />
      <input aria-label="other" />
    </>
  );
}

describe("v1 regressions", () => {
  it("#1 TR currency keeps kuruş", () => {
    const mask = createMask({ currency: "TRY" });
    expect(mask.parse("₺1.234,56")).toBe("1234.56");
    expect(mask.format("1234.56")).toBe("₺1.234,56");
  });

  it("#2 no rawValue (or any unknown prop) reaches the DOM", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<PhoneForm />);
    expect(error).not.toHaveBeenCalled();
    expect(screen.getByLabelText("phone").hasAttribute("rawvalue")).toBe(false);
    error.mockRestore();
  });

  it("#3 validators run on the server", () => {
    const result = parseMasked({ tckn: "tckn" }, { tckn: "123 456 789 01" });
    expect(result).toMatchObject({ success: false, errors: { tckn: "tckn.invalid" } });
  });

  it("#8 a dead key that never sends compositionend does not freeze the input", () => {
    render(<PhoneForm />);
    const input = screen.getByLabelText<HTMLInputElement>("phone");
    input.focus();
    fireEvent.compositionStart(input);
    // The browser reports composing has ended without a compositionend event.
    fireEvent.input(input, { target: { value: "555" }, isComposing: false });
    expect(input.value).toBe("(555");
  });

  it("#8 blur does not write the masked text into the form", async () => {
    let form!: UseFormReturn<{ phone: string }>;
    render(<PhoneForm onForm={(f) => (form = f)} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("phone"), "5551234567");
    await user.click(screen.getByLabelText("other"));
    expect(form.getValues("phone")).toBe("5551234567");
    expect(form.getFieldState("phone").isTouched).toBe(true);
  });

  it("#9 aria-describedby is not pointed at a missing element", () => {
    render(<PhoneForm />);
    expect(screen.getByLabelText("phone").hasAttribute("aria-describedby")).toBe(false);
  });

  it("#12 IBAN is not tied to TR", () => {
    expect(createMask("iban").validate("DE89370400440532013000")).toBeUndefined();
  });

  it("#13 cvv only reads the field named in from", () => {
    const cvv = createMask("cvv");
    expect(cvv.format("1234", { from: undefined })).toBe("123");
  });
});
