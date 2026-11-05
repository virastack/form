import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm, type UseFormReturn } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { useViraPasswordForm } from "../src/form";
import { definePolicy } from "../src/strength";

const policy = definePolicy();
const STRONG = "vu7#Kq2!mz9@Lw4X-bt5Rn8Jy";

type Values = { email: string; password: string; confirm: string };

let form!: UseFormReturn<Values>;

function Signup({ onSubmit = () => {} }: { onSubmit?: (values: Values) => void }) {
  form = useForm<Values>({ defaultValues: { email: "selin@example.com", password: "", confirm: "" } });
  const { password, confirm } = useViraPasswordForm(form, { name: "password", confirm: "confirm", policy, forbidden: ["email"] });
  const { errors } = form.formState;

  return (
    <form method="post" onSubmit={form.handleSubmit(onSubmit)}>
      <input aria-label="Email" {...form.register("email")} />
      <input aria-label="Password" {...password.inputProps} />
      <button {...password.btnProps} />
      <p {...password.strengthProps}>{password.strength?.level ?? "none"}</p>
      <p data-testid="password-error">{errors.password?.message}</p>
      <input aria-label="Confirm" {...confirm.inputProps} />
      <p data-testid="confirm-error">{errors.confirm?.message}</p>
      <button type="submit">Sign up</button>
    </form>
  );
}

const field = (name: string) => screen.getByLabelText(name) as HTMLInputElement;

describe("useViraPasswordForm", () => {
  it("registers both fields: name, value and strength come from the form", async () => {
    render(<Signup />);
    await userEvent.type(field("Password"), STRONG);
    expect(field("Password")).toHaveAttribute("name", "password");
    expect(field("Confirm")).toHaveAttribute("name", "confirm");
    expect(form.getValues("password")).toBe(STRONG);
    expect(screen.getByRole("status")).toHaveTextContent("strong");
    expect(field("Password")).toHaveAttribute("autocomplete", "new-password");
    expect(field("Confirm")).toHaveAttribute("autocomplete", "new-password");
  });

  it("validates with the policy and the confirmation on submit", async () => {
    const onSubmit = vi.fn();
    render(<Signup onSubmit={onSubmit} />);
    await userEvent.type(field("Password"), "short");
    await userEvent.type(field("Confirm"), "other");
    await userEvent.click(screen.getByRole("button", { name: "Sign up" }));
    await waitFor(() => expect(screen.getByTestId("password-error")).toHaveTextContent("password.tooShort"));
    expect(screen.getByTestId("confirm-error")).toHaveTextContent("password.mismatch");
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.clear(field("Password"));
    await userEvent.type(field("Password"), STRONG);
    await userEvent.clear(field("Confirm"));
    await userEvent.type(field("Confirm"), STRONG);
    await userEvent.click(screen.getByRole("button", { name: "Sign up" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it("re-checks the confirm field when the password changes, without deps", async () => {
    render(<Signup />);
    await userEvent.type(field("Password"), STRONG);
    await userEvent.type(field("Confirm"), STRONG);
    await userEvent.tab();
    expect(screen.getByTestId("confirm-error")).toBeEmptyDOMElement();

    await userEvent.type(field("Password"), "x");
    await waitFor(() => expect(screen.getByTestId("confirm-error")).toHaveTextContent("password.mismatch"));
  });

  it("re-checks after setValue() too, which fires no input event", async () => {
    render(<Signup />);
    await userEvent.type(field("Password"), STRONG);
    await userEvent.type(field("Confirm"), STRONG);
    await userEvent.tab();
    act(() => form.setValue("password", `${STRONG}!`));
    await waitFor(() => expect(screen.getByTestId("confirm-error")).toHaveTextContent("password.mismatch"));
  });

  it("re-checks the password when a forbidden field changes", async () => {
    render(<Signup />);
    await userEvent.type(field("Password"), "kerem-1990-2024-!!");
    await userEvent.tab();
    expect(screen.getByTestId("password-error")).toBeEmptyDOMElement();

    await userEvent.clear(field("Email"));
    await userEvent.type(field("Email"), "kerem@example.com");
    await waitFor(() => expect(screen.getByTestId("password-error")).toHaveTextContent("password.containsPersonalInfo"));
  });

  it("does not show errors on a field the user has not left yet", async () => {
    render(<Signup />);
    act(() => form.setValue("confirm", "abc"));
    await userEvent.type(field("Password"), "abcd");
    expect(screen.getByTestId("confirm-error")).toBeEmptyDOMElement();
  });

  it("follows reset() and setValue()", async () => {
    render(<Signup />);
    act(() => form.setValue("password", STRONG));
    expect(screen.getByRole("status")).toHaveTextContent("strong");
    act(() => form.reset({ email: "a@example.com", password: "abc", confirm: "" }));
    expect(field("Password").value).toBe("abc");
    expect(screen.getByRole("status")).toHaveTextContent("weak");
  });

  it("returns confirm as null without the option, and works without a policy", async () => {
    let result!: ReturnType<typeof useViraPasswordForm<{ password: string }>>;
    function Login() {
      const login = useForm<{ password: string }>({ defaultValues: { password: "" } });
      result = useViraPasswordForm(login, { name: "password" });
      return <input aria-label="Password" {...result.password.inputProps} />;
    }
    render(<Login />);
    expect(result.confirm).toBeNull();
    expect(result.password.strength).toBeNull();
    expect(field("Password")).toHaveAttribute("autocomplete", "current-password");
    await userEvent.click(field("Password"));
    expect(field("Password")).toHaveAttribute("type", "password");
  });

  it("passes the shared options to both fields", async () => {
    function Hidden() {
      const f = useForm<Values>({ defaultValues: { email: "", password: "", confirm: "" } });
      const { password, confirm } = useViraPasswordForm(f, { name: "password", confirm: "confirm", defaultVisible: true });
      return (
        <>
          <input aria-label="Password" {...password.inputProps} />
          <input aria-label="Confirm" {...confirm.inputProps} />
        </>
      );
    }
    render(<Hidden />);
    expect(field("Password")).toHaveAttribute("type", "text");
    expect(field("Confirm")).toHaveAttribute("type", "text");
  });

  it("compares the confirmation with the policy's normalization", async () => {
    const nfc = definePolicy({ normalization: "NFC" });
    let check!: (value: unknown) => unknown;
    function Nfc() {
      const f = useForm<Values>({ defaultValues: { email: "", password: "ｓｅｃｒｅｔ", confirm: "" } });
      const { confirm } = useViraPasswordForm(f, { name: "password", confirm: "confirm", policy: nfc });
      check = confirm.rule.validate;
      return null;
    }
    render(<Nfc />);
    expect(check("secret")).toBe("password.mismatch");
    expect(check("ｓｅｃｒｅｔ")).toBe(true);
  });
});
