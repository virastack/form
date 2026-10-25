// Real Chromium through Playwright: keyboard, clipboard, selection and composition behave like in the browser.
import { useForm, type UseFormReturn } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { useViraMask } from "../../src";

type F = { phone: string; card: string; cvv: string; price: string; date: string };
let form!: UseFormReturn<F>;

function Checkout() {
  form = useForm<F>({ defaultValues: { phone: "", card: "", cvv: "", price: "", date: "" } });
  const m = useViraMask(form, {
    phone: "phoneTR",
    card: "card",
    cvv: { preset: "cvv", from: "card" },
    price: "currency",
    date: "date",
  });
  return (
    <form>
      <input aria-label="phone" {...m.phone} />
      <input aria-label="card" {...m.card} />
      <input aria-label="cvv" {...m.cvv} />
      <input aria-label="price" {...m.price} />
      <input aria-label="date" {...m.date} />
    </form>
  );
}

const el = (label: string) => page.getByLabelText(label).element() as HTMLInputElement;

describe("in a real browser", () => {
  it("types with the keyboard", async () => {
    await render(<Checkout />);
    await userEvent.type(page.getByLabelText("phone"), "05551234567");
    expect(el("phone").value).toBe("(555) 123 45 67");
    expect(form.getValues("phone")).toBe("5551234567");
  });

  it("backspace and delete around separators", async () => {
    await render(<Checkout />);
    await userEvent.type(page.getByLabelText("phone"), "5551234567");
    const input = el("phone");
    input.setSelectionRange(6, 6); // after "(555) "
    await userEvent.keyboard("{Backspace}");
    expect(input.value).toBe("(551) 234 56 7");
    expect(input.selectionStart).toBe(3);
    input.setSelectionRange(4, 4); // before ")"
    await userEvent.keyboard("{Delete}");
    expect(input.value).toBe("(551) 345 67");
  });

  it("keeps the caret when typing in the middle", async () => {
    await render(<Checkout />);
    await userEvent.type(page.getByLabelText("card"), "4111111111111111");
    const input = el("card");
    input.setSelectionRange(5, 5);
    await userEvent.keyboard("2");
    expect(input.value).toBe("4111 2111 1111 1111");
    expect(input.selectionStart).toBe(6);
  });

  it("pastes formatted text", async () => {
    await render(<Checkout />);
    await userEvent.click(page.getByLabelText("phone"));
    const input = el("phone");
    // insertText goes through the browser's own editing path, like a paste.
    document.execCommand("insertText", false, "+90 (532) 111 22 33");
    expect(input.value).toBe("(532) 111 22 33");
    expect(form.getValues("phone")).toBe("5321112233");
  });

  it("handles autofill (value set, then an input event)", async () => {
    await render(<Checkout />);
    const input = el("card");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "378282246310005");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(input.value).toBe("3782 822463 10005");
    expect(form.getValues("card")).toBe("378282246310005");
  });

  it("formats only after IME composition ends", async () => {
    await render(<Checkout />);
    const input = el("phone");
    input.focus();
    input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "555");
    input.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true, inputType: "insertCompositionText" }));
    expect(input.value).toBe("555");
    input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "555" }));
    expect(input.value).toBe("(555");
  });

  it("currency, date auto-correct and linked CVV", async () => {
    await render(<Checkout />);
    await userEvent.type(page.getByLabelText("price"), "1234,5");
    expect(el("price").value).toBe("₺1.234,5");
    await userEvent.type(page.getByLabelText("date"), "4");
    expect(el("date").value).toBe("04/");
    await userEvent.type(page.getByLabelText("card"), "3782");
    await userEvent.type(page.getByLabelText("cvv"), "12345");
    expect(el("cvv").value).toBe("1234");
  });
});
