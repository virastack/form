import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm, type UseFormReturn } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { useViraPassword } from "../src";
import { definePolicy } from "../src/strength";

const policy = definePolicy();
const STRONG = "vu7#Kq2!mz9@Lw4X-bt5Rn8Jy";

type Values = { email: string; password: string; confirm: string };

let form!: UseFormReturn<Values>;

function Signup({ onSubmit = () => {} }: { onSubmit?: (values: Values) => void }) {
  form = useForm<Values>({ defaultValues: { email: "selin@example.com", password: "", confirm: "" } });
  const { password, confirm } = useViraPassword(form, {
    password: { policy, forbidden: ["email"] },
    confirm: { matchWith: "password" },
  });
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

describe("useViraPassword(form, schema)", () => {
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

  it("works with one field and without a policy", async () => {
    let result!: { password: ReturnType<typeof useViraPassword> };
    function Login() {
      const login = useForm<{ password: string }>({ defaultValues: { password: "" } });
      result = useViraPassword(login, { password: {} });
      return <input aria-label="Password" {...result.password.inputProps} />;
    }
    render(<Login />);
    expect(result.password.strength).toBeNull();
    expect(field("Password")).toHaveAttribute("autocomplete", "current-password");
    await userEvent.click(field("Password"));
    expect(field("Password")).toHaveAttribute("type", "password");
  });

  it("passes each entry its own options", async () => {
    function Hidden() {
      const f = useForm<Values>({ defaultValues: { email: "", password: "", confirm: "" } });
      const { password, confirm } = useViraPassword(f, { password: { defaultVisible: true }, confirm: { matchWith: "password" } });
      return (
        <>
          <input aria-label="Password" {...password.inputProps} />
          <input aria-label="Confirm" {...confirm.inputProps} />
        </>
      );
    }
    render(<Hidden />);
    expect(field("Password")).toHaveAttribute("type", "text");
    expect(field("Confirm")).toHaveAttribute("type", "password");
  });

  it("compares the confirmation with the password policy's normalization", async () => {
    const nfc = definePolicy({ normalization: "NFC" });
    let check!: (value: unknown) => unknown;
    function Nfc() {
      const f = useForm<Values>({ defaultValues: { email: "", password: "ｓｅｃｒｅｔ", confirm: "" } });
      const { confirm } = useViraPassword(f, { password: { policy: nfc }, confirm: { matchWith: "password" } });
      check = confirm.rule.validate;
      return null;
    }
    render(<Nfc />);
    expect(check("secret")).toBe("password.mismatch");
    expect(check("ｓｅｃｒｅｔ")).toBe(true);
  });

  it("maps a key to another field with name, and keeps extra rules", async () => {
    type Nested = { account: { secret: string } };
    let nested!: UseFormReturn<Nested>;
    function Account() {
      nested = useForm<Nested>({ defaultValues: { account: { secret: "" } } });
      const { secret } = useViraPassword(nested, { secret: { name: "account.secret", rules: { required: "required" } } });
      const { errors } = nested.formState;
      return (
        <form onSubmit={nested.handleSubmit(() => {})}>
          <input aria-label="Secret" {...secret.inputProps} />
          <p data-testid="secret-error">{errors.account?.secret?.message}</p>
          <button type="submit">Save</button>
        </form>
      );
    }
    render(<Account />);
    expect(field("Secret")).toHaveAttribute("name", "account.secret");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByTestId("secret-error")).toHaveTextContent("required"));
    await userEvent.type(field("Secret"), "abc");
    expect(nested.getValues("account.secret")).toBe("abc");
  });

  it("runs a validate from rules after the password check", async () => {
    const onSubmit = vi.fn();
    function Custom() {
      const f = useForm<{ password: string }>({ defaultValues: { password: "" } });
      const { password } = useViraPassword(f, {
        password: { policy, rules: { validate: (value) => !String(value).includes("acme") || "custom.noAcme" } },
      });
      return (
        <form onSubmit={f.handleSubmit(onSubmit)}>
          <input aria-label="Password" {...password.inputProps} />
          <p data-testid="password-error">{f.formState.errors.password?.message}</p>
          <button type="submit">Save</button>
        </form>
      );
    }
    render(<Custom />);
    await userEvent.type(field("Password"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByTestId("password-error")).toHaveTextContent("password.tooShort"));
    await userEvent.clear(field("Password"));
    await userEvent.type(field("Password"), `${STRONG}acme`);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByTestId("password-error")).toHaveTextContent("custom.noAcme"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps the root entry usable without a form", () => {
    let result!: ReturnType<typeof useViraPassword>;
    function Plain() {
      result = useViraPassword({ policy });
      return <input aria-label="Password" {...result.inputProps} />;
    }
    render(<Plain />);
    expect(result.strength?.level).toBe("weak");
    expect(field("Password")).not.toHaveAttribute("name");
  });
});
