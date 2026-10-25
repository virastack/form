import { zodResolver } from "@hookform/resolvers/zod";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState, type ReactNode } from "react";
import { Controller, useForm, type UseFormReturn } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { maskResolver, useViraMask } from "../src";

type Values = Record<string, unknown>;

function setup<T extends Values>(
  options: Parameters<typeof useForm<T>>[0],
  renderFields: (form: UseFormReturn<T>) => ReactNode,
) {
  const api: { form?: UseFormReturn<T> } = {};
  const onSubmit = vi.fn();
  function Form() {
    const form = useForm<T>(options);
    api.form = form;
    return <form onSubmit={form.handleSubmit(onSubmit)}>{renderFields(form)}<button type="submit">submit</button></form>;
  }
  const utils = render(<Form />);
  return { ...utils, api: api as { form: UseFormReturn<T> }, onSubmit, user: userEvent.setup() };
}

afterEach(() => vi.restoreAllMocks());

describe("useViraMask with React Hook Form", () => {
  it("shows the mask while the form keeps the raw value", async () => {
    let watched: unknown;
    function Phone({ form }: { form: UseFormReturn<{ phone: string }> }) {
      const { phone } = useViraMask(form, { phone: "phoneTR" });
      watched = form.watch("phone");
      return (
        <>
          <input aria-label="phone" {...phone} />
          <output>{String(form.formState.isDirty)}</output>
        </>
      );
    }
    const { api, user } = setup<{ phone: string }>({}, (form) => <Phone form={form} />);
    const input = screen.getByLabelText<HTMLInputElement>("phone");

    await user.type(input, "5551234567");
    expect(input.value).toBe("(555) 123 45 67");
    expect(api.form.getValues("phone")).toBe("5551234567");
    expect(watched).toBe("5551234567");
    expect(screen.getByRole("status").textContent).toBe("true");
  });

  it("renders default values masked", () => {
    function Fields({ form }: { form: UseFormReturn<{ phone: string; iban: string }> }) {
      const { phone, iban } = useViraMask(form, { phone: "phoneTR", iban: "ibanTR" });
      return (
        <>
          <input aria-label="phone" {...phone} />
          <input aria-label="iban" {...iban} />
        </>
      );
    }
    setup<{ phone: string; iban: string }>(
      { defaultValues: { phone: "5551234567", iban: "TR330006100519786457841326" } },
      (form) => <Fields form={form} />,
    );
    expect(screen.getByLabelText<HTMLInputElement>("phone").value).toBe("(555) 123 45 67");
    expect(screen.getByLabelText<HTMLInputElement>("iban").value).toBe("TR33 0006 1005 1978 6457 8413 26");
  });

  it("reflects reset() and setValue() on screen", async () => {
    function Phone({ form }: { form: UseFormReturn<{ phone: string }> }) {
      const { phone } = useViraMask(form, { phone: "phoneTR" });
      return <input aria-label="phone" {...phone} />;
    }
    const { api, user } = setup<{ phone: string }>({ defaultValues: { phone: "5001112233" } }, (form) => (
      <Phone form={form} />
    ));
    const input = screen.getByLabelText<HTMLInputElement>("phone");

    await user.clear(input);
    await user.type(input, "5551234567");
    act(() => api.form.reset());
    await waitFor(() => expect(input.value).toBe("(500) 111 22 33"));
    expect(api.form.getValues("phone")).toBe("5001112233");

    act(() => api.form.reset({ phone: "5321234567" }));
    await waitFor(() => expect(input.value).toBe("(532) 123 45 67"));

    act(() => api.form.setValue("phone", "5449998877"));
    expect(input.value).toBe("(544) 999 88 77");

    act(() => api.form.setValue("phone", ""));
    expect(input.value).toBe("");

    await user.type(input, "5");
    expect(api.form.getValues("phone")).toBe("5");
  });

  it("passes register rules through (required, minLength, setValueAs, deps, onChange)", async () => {
    const onChange = vi.fn();
    type F = { tckn: string; amount: string; other: string };
    function Fields({ form }: { form: UseFormReturn<F> }) {
      const { tckn, amount } = useViraMask(form, {
        tckn: { preset: "tckn", rules: { required: "required", onChange, deps: "other" } },
        amount: { preset: "number", rules: { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) } },
      });
      return (
        <>
          <input aria-label="tckn" {...tckn} />
          <input aria-label="amount" {...amount} />
          <input aria-label="other" {...form.register("other", { validate: () => "other.checked" })} />
          <span>{form.formState.errors.tckn?.message}</span>
          <span>{form.formState.errors.other?.message}</span>
        </>
      );
    }
    const { api, user, onSubmit } = setup<F>({}, (form) => <Fields form={form} />);

    await user.click(screen.getByText("submit"));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText("required")).toBeTruthy();
    expect(screen.getByLabelText("tckn").getAttribute("aria-invalid")).toBe("true");

    await user.type(screen.getByLabelText("tckn"), "1");
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.lastCall?.[0].target.value).toBe("1");
    // deps: changing tckn re-validates "other"
    expect(await screen.findByText("other.checked")).toBeTruthy();

    await user.type(screen.getByLabelText("amount"), "1234");
    expect(api.form.getValues("amount")).toBe(1234);
    expect(screen.getByLabelText<HTMLInputElement>("amount").value).toBe("1.234");
  });

  it("validates with error keys and clears them when fixed", async () => {
    type F = { tckn: string };
    function Fields({ form }: { form: UseFormReturn<F> }) {
      const { tckn } = useViraMask(form, { tckn: "tckn" });
      return (
        <>
          <input aria-label="tckn" {...tckn} />
          <p role="alert">{form.formState.errors.tckn?.message}</p>
        </>
      );
    }
    const { user, onSubmit } = setup<F>({}, (form) => <Fields form={form} />);
    const input = screen.getByLabelText("tckn");
    await user.type(input, "12345678901");
    await user.click(screen.getByText("submit"));
    expect(screen.getByRole("alert").textContent).toBe("tckn.invalid");
    expect(onSubmit).not.toHaveBeenCalled();

    await user.clear(input);
    await user.type(input, "10000000146");
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(""));
    await user.click(screen.getByText("submit"));
    expect(onSubmit).toHaveBeenCalledWith({ tckn: "10000000146" }, expect.anything());
  });

  it("disabled rule disables the input and skips the value", async () => {
    type F = { phone: string };
    function Fields({ form }: { form: UseFormReturn<F> }) {
      const { phone } = useViraMask(form, { phone: { preset: "phoneTR", rules: { disabled: true } } });
      return <input aria-label="phone" {...phone} />;
    }
    setup<F>({}, (form) => <Fields form={form} />);
    expect(screen.getByLabelText<HTMLInputElement>("phone").disabled).toBe(true);
  });

  it("works next to Controller and plain register", async () => {
    type F = { phone: string; name: string; note: string };
    function Fields({ form }: { form: UseFormReturn<F> }) {
      const { phone } = useViraMask(form, { phone: "phoneTR" });
      return (
        <>
          <input aria-label="phone" {...phone} />
          <input aria-label="name" {...form.register("name")} />
          <Controller control={form.control} name="note" render={({ field }) => <input aria-label="note" {...field} />} />
        </>
      );
    }
    const { user, onSubmit } = setup<F>({ defaultValues: { phone: "", name: "", note: "" } }, (form) => <Fields form={form} />);
    await user.type(screen.getByLabelText("phone"), "5551234567");
    await user.type(screen.getByLabelText("name"), "Ömer");
    await user.type(screen.getByLabelText("note"), "hi");
    await user.click(screen.getByText("submit"));
    expect(onSubmit).toHaveBeenCalledWith({ phone: "5551234567", name: "Ömer", note: "hi" }, expect.anything());
  });

  it("supports nested names", async () => {
    type F = { address: { zip: string } };
    function Fields({ form }: { form: UseFormReturn<F> }) {
      const { zip } = useViraMask(form, { zip: { name: "address.zip", mask: "99999" } });
      return <input aria-label="zip" {...zip} />;
    }
    const { api, user } = setup<F>({ defaultValues: { address: { zip: "" } } }, (form) => <Fields form={form} />);
    await user.type(screen.getByLabelText("zip"), "34000x9");
    expect(api.form.getValues("address.zip")).toBe("34000");
  });

  it("output: masked writes the display text into the form", async () => {
    type F = { phone: string };
    function Fields({ form }: { form: UseFormReturn<F> }) {
      const { phone } = useViraMask(form, { phone: { preset: "phoneTR", output: "masked" } });
      return <input aria-label="phone" {...phone} />;
    }
    const { api, user } = setup<F>({}, (form) => <Fields form={form} />);
    await user.type(screen.getByLabelText("phone"), "5551234567");
    expect(api.form.getValues("phone")).toBe("(555) 123 45 67");
    act(() => api.form.setValue("phone", "5321112233"));
    expect(screen.getByLabelText<HTMLInputElement>("phone").value).toBe("(532) 111 22 33");
  });

  it("onComplete fires once when the mask fills up", async () => {
    const onComplete = vi.fn();
    type F = { card: string };
    function Fields({ form }: { form: UseFormReturn<F> }) {
      const { card } = useViraMask(form, { card: { preset: "card", onComplete } });
      return <input aria-label="card" {...card} />;
    }
    const { user } = setup<F>({}, (form) => <Fields form={form} />);
    await user.type(screen.getByLabelText("card"), "41111111111111119");
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("4111111111111111");
  });

  it("does not leak unknown props to the DOM", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    type F = { phone: string; card: string; date: string; price: string };
    function Fields({ form }: { form: UseFormReturn<F> }) {
      const fields = useViraMask(form, { phone: "phoneTR", card: "card", date: "date", price: "currency" });
      return (
        <>
          {Object.entries(fields).map(([key, props]) => (
            <input key={key} aria-label={key} {...props} />
          ))}
        </>
      );
    }
    setup<F>({}, (form) => <Fields form={form} />);
    expect(error).not.toHaveBeenCalled();
    const input = screen.getByLabelText("phone");
    expect(input.hasAttribute("aria-describedby")).toBe(false);
    expect(input.getAttribute("inputmode")).toBe("tel");
  });
});

describe("linked fields (from)", () => {
  it("cvv follows the card type, and trims when it changes", async () => {
    type F = { card: string; cvv: string };
    function Fields({ form }: { form: UseFormReturn<F> }) {
      const { card, cvv } = useViraMask(form, { card: "card", cvv: { preset: "cvv", from: "card" } });
      return (
        <>
          <input aria-label="card" {...card} />
          <input aria-label="cvv" {...cvv} />
        </>
      );
    }
    const { api, user } = setup<F>({ defaultValues: { card: "", cvv: "" } }, (form) => <Fields form={form} />);
    const card = screen.getByLabelText<HTMLInputElement>("card");
    const cvv = screen.getByLabelText<HTMLInputElement>("cvv");

    await user.type(card, "378282246310005");
    await user.type(cvv, "12345");
    expect(cvv.value).toBe("1234");
    expect(api.form.getValues("cvv")).toBe("1234");

    await user.clear(card);
    await user.type(card, "4111111111111111");
    await waitFor(() => expect(cvv.value).toBe("123"));
    expect(api.form.getValues("cvv")).toBe("123");
  });

  it("currency follows a select", async () => {
    type F = { code: string; price: string };
    function Fields({ form }: { form: UseFormReturn<F> }) {
      const { price } = useViraMask(form, { price: { preset: "currency", from: "code" } });
      return (
        <>
          <select aria-label="code" {...form.register("code")}>
            <option value="TRY">TRY</option>
            <option value="USD">USD</option>
          </select>
          <input aria-label="price" {...price} />
        </>
      );
    }
    const { api, user } = setup<F>({ defaultValues: { code: "TRY", price: "1234.5" } }, (form) => <Fields form={form} />);
    const price = screen.getByLabelText<HTMLInputElement>("price");
    expect(price.value).toBe("₺1.234,5");
    await user.selectOptions(screen.getByLabelText("code"), "USD");
    await waitFor(() => expect(price.value).toBe("$1,234.5"));
    expect(api.form.getValues("price")).toBe("1234.5");
  });

  it("end date can't be before start date", async () => {
    type F = { start: string; end: string };
    function Fields({ form }: { form: UseFormReturn<F> }) {
      const { start, end } = useViraMask(form, { start: "date", end: { preset: "date", from: "start" } });
      return (
        <>
          <input aria-label="start" {...start} />
          <input aria-label="end" {...end} />
          <p role="alert">{form.formState.errors.end?.message}</p>
        </>
      );
    }
    const { user } = setup<F>({ defaultValues: { start: "", end: "" } }, (form) => <Fields form={form} />);
    await user.type(screen.getByLabelText("start"), "10022026");
    await user.type(screen.getByLabelText("end"), "01022026");
    await user.click(screen.getByText("submit"));
    expect(screen.getByRole("alert").textContent).toBe("date.beforeFrom");
    // moving the start date re-validates the end date
    await user.clear(screen.getByLabelText("start"));
    await user.type(screen.getByLabelText("start"), "01012026");
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(""));
  });

  it("warns in development when from points to a missing field", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    type F = { cvv: string };
    function Fields({ form }: { form: UseFormReturn<F> }) {
      const { cvv } = useViraMask(form, { cvv: { preset: "cvv", from: "cvv" } });
      return <input aria-label="cvv" {...cvv} />;
    }
    function Form() {
      const form = useForm<F>();
      return <Fields form={form} />;
    }
    render(<Form />);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("no field"));
    const missing = vi.fn();
    function Missing() {
      const form = useForm<{ cvv: string; card?: string }>({ defaultValues: { cvv: "" } });
      const { cvv } = useViraMask(form, { cvv: { preset: "cvv", from: "card" } });
      missing();
      return <input {...cvv} />;
    }
    render(<Missing />);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('reads from "card"'));
  });
});

describe("resolvers", () => {
  const masks = { tckn: "tckn", phone: "phoneTR" } as const;
  const schema = z.object({ tckn: z.string().min(1, "required"), phone: z.string() });

  function Fields({ form }: { form: UseFormReturn<z.input<typeof schema>> }) {
    const { tckn, phone } = useViraMask(form, masks);
    return (
      <>
        <input aria-label="tckn" {...tckn} />
        <input aria-label="phone" {...phone} />
        <p data-testid="tckn-error">{form.formState.errors.tckn?.message}</p>
        <p data-testid="phone-error">{form.formState.errors.phone?.message}</p>
      </>
    );
  }

  it("warns when a plain resolver would skip mask validation", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    setup({ resolver: zodResolver(schema) }, (form) => <Fields form={form as UseFormReturn<z.input<typeof schema>>} />);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("maskResolver"));
  });

  it("maskResolver keeps both zod and mask errors", async () => {
    const { user, onSubmit } = setup({ resolver: maskResolver(masks, zodResolver(schema)) }, (form) => (
      <Fields form={form as UseFormReturn<z.input<typeof schema>>} />
    ));
    await user.type(screen.getByLabelText("phone"), "555");
    await user.click(screen.getByText("submit"));
    expect(screen.getByTestId("tckn-error").textContent).toBe("required");
    expect(screen.getByTestId("phone-error").textContent).toBe("phoneTR.incomplete");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("maskResolver accepts a Standard Schema directly", async () => {
    const { user, onSubmit } = setup({ resolver: maskResolver(masks, schema) }, (form) => (
      <Fields form={form as UseFormReturn<z.input<typeof schema>>} />
    ));
    await user.type(screen.getByLabelText("tckn"), "12345678901");
    await user.click(screen.getByText("submit"));
    expect(screen.getByTestId("tckn-error").textContent).toBe("tckn.invalid");

    await user.clear(screen.getByLabelText("tckn"));
    await user.type(screen.getByLabelText("tckn"), "10000000146");
    await user.click(screen.getByText("submit"));
    expect(onSubmit).toHaveBeenCalledWith({ tckn: "10000000146", phone: "" }, expect.anything());
  });
});

describe("editing details", () => {
  function Phone() {
    const form = useForm<{ phone: string }>();
    const { phone } = useViraMask(form, { phone: "phoneTR" });
    return <input aria-label="phone" {...phone} />;
  }

  it("handles paste", async () => {
    render(<Phone />);
    const user = userEvent.setup();
    const input = screen.getByLabelText<HTMLInputElement>("phone");
    await user.click(input);
    await user.paste("+90 555 123 45 67");
    expect(input.value).toBe("(555) 123 45 67");
  });

  it("waits for IME composition to end", () => {
    render(<Phone />);
    const input = screen.getByLabelText<HTMLInputElement>("phone");
    input.focus();
    fireEvent.compositionStart(input);
    fireEvent.input(input, { target: { value: "555" }, isComposing: true });
    expect(input.value).toBe("555");
    fireEvent.compositionEnd(input);
    expect(input.value).toBe("(555");
  });

  it("keeps the caret after a mid-text edit", async () => {
    render(<Phone />);
    const user = userEvent.setup();
    const input = screen.getByLabelText<HTMLInputElement>("phone");
    await user.type(input, "5551234567");
    // put the caret after "(555) 12" and type 9
    input.setSelectionRange(8, 8);
    await user.type(input, "9", { initialSelectionStart: 8, initialSelectionEnd: 8 });
    expect(input.value).toBe("(555) 129 34 56");
    expect(input.selectionStart).toBe(9);
  });

  it("unmounting keeps the value unless shouldUnregister", async () => {
    function Toggle({ shouldUnregister }: { shouldUnregister: boolean }) {
      const form = useForm<{ phone: string }>({ shouldUnregister, defaultValues: { phone: "5551234567" } });
      const [show, setShow] = useState(true);
      return (
        <>
          {show && <Inner form={form} />}
          <button onClick={() => setShow((v) => !v)}>toggle</button>
          <output>{JSON.stringify(form.watch())}</output>
        </>
      );
    }
    function Inner({ form }: { form: UseFormReturn<{ phone: string }> }) {
      const { phone } = useViraMask(form, { phone: "phoneTR" });
      return <input aria-label="phone" {...phone} />;
    }
    const user = userEvent.setup();
    const { unmount } = render(<Toggle shouldUnregister={false} />);
    await user.click(screen.getByText("toggle"));
    expect(screen.getByRole("status").textContent).toContain("5551234567");
    await user.click(screen.getByText("toggle"));
    expect(screen.getByLabelText<HTMLInputElement>("phone").value).toBe("(555) 123 45 67");
    unmount();

    render(<Toggle shouldUnregister />);
    await user.click(screen.getByText("toggle"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("{}"));
  });

  it("works under StrictMode", async () => {
    const { StrictMode } = await import("react");
    let form!: UseFormReturn<{ phone: string }>;
    function App() {
      form = useForm<{ phone: string }>({ defaultValues: { phone: "5551234567" } });
      const { phone } = useViraMask(form, { phone: "phoneTR" });
      useEffect(() => {}, []);
      return <input aria-label="phone" {...phone} />;
    }
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    const user = userEvent.setup();
    const input = screen.getByLabelText<HTMLInputElement>("phone");
    expect(input.value).toBe("(555) 123 45 67");
    await user.clear(input);
    await user.type(input, "5321112233");
    expect(form.getValues("phone")).toBe("5321112233");
  });
});
