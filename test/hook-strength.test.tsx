import { zodResolver } from "@hookform/resolvers/zod";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Controller, useForm, type UseFormReturn } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { mergeProps, useViraPassword, type UseViraPasswordOptions } from "../src";
import { definePolicy, evaluate } from "../src/strength";

const policy = definePolicy();
const STRONG = "vu7#Kq2!mz9@Lw4X";

function Meter(props: UseViraPasswordOptions) {
  const pw = useViraPassword(props);
  return (
    <>
      <input aria-label="Password" {...pw.inputProps} />
      <p {...pw.strengthProps}>{pw.strength?.level ?? "none"}</p>
      <ul>
        {pw.issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
    </>
  );
}

const input = () => screen.getByLabelText("Password") as HTMLInputElement;

describe("without a policy", () => {
  it("has no strength and passes the rule", () => {
    const { result } = renderHook(() => useViraPassword());
    expect(result.current.strength).toBeNull();
    expect(result.current.issues).toEqual([]);
    expect(result.current.rule.validate("x")).toBe(true);
    expect(result.current.inputProps.autoComplete).toBe("current-password");
    expect(result.current.inputProps["aria-describedby"]).toBeUndefined();
    expect(result.current.inputProps.onChange).toBeUndefined();
  });
});

describe("with a policy", () => {
  it("defaults autoComplete to new-password", () => {
    const { result } = renderHook(() => useViraPassword({ policy }));
    expect(result.current.inputProps.autoComplete).toBe("new-password");
    const { result: overridden } = renderHook(() => useViraPassword({ policy, autoComplete: "current-password" }));
    expect(overridden.current.inputProps.autoComplete).toBe("current-password");
  });

  it("follows typing and announces the result", async () => {
    render(<Meter policy={policy} />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
    expect(input()).toHaveAttribute("aria-describedby", status.id);
    expect(status).toHaveTextContent("weak");
    expect(screen.getByText("password.tooShort")).toBeInTheDocument();
    await userEvent.type(input(), STRONG);
    expect(status).toHaveTextContent("strong");
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it("keeps the user's aria-describedby", () => {
    render(<Meter policy={policy} inputProps={{ "aria-describedby": "hint" }} />);
    expect(input().getAttribute("aria-describedby")).toBe(`${screen.getByRole("status").id} hint`);
  });

  it("matches the engine for the same input", async () => {
    let pw!: ReturnType<typeof useViraPassword>;
    function Probe() {
      pw = useViraPassword({ policy, forbidden: ["omer@example.com"] });
      return <input aria-label="Password" {...pw.inputProps} />;
    }
    render(<Probe />);
    await userEvent.type(input(), "omer-garden-path-91");
    expect(pw.strength).toEqual(evaluate("omer-garden-path-91", policy, { forbidden: ["omer@example.com"] }));
    expect(pw.issues).toEqual(["password.containsPersonalInfo"]);
  });

  it("only follows typing when nothing else gives the value", () => {
    const user = () => {};
    expect(renderHook(() => useViraPassword({ policy })).result.current.inputProps.onChange).toBeTypeOf("function");
    expect(renderHook(() => useViraPassword({ policy, value: "" })).result.current.inputProps.onChange).toBeUndefined();
    expect(renderHook(() => useViraPassword({ policy, inputProps: { value: "", onChange: user } })).result.current.inputProps.onChange).toBe(user);
  });

  it("prefers the value option over typing", async () => {
    const { rerender } = render(<Meter policy={policy} value={STRONG} />);
    expect(screen.getByRole("status")).toHaveTextContent("strong");
    rerender(<Meter policy={policy} value="" />);
    expect(screen.getByRole("status")).toHaveTextContent("weak");
  });

  it("reads a controlled inputProps.value and an initial defaultValue", () => {
    const { result } = renderHook(() => useViraPassword({ policy, inputProps: { value: STRONG, onChange: () => {} } }));
    expect(result.current.strength?.level).toBe("strong");
    const { result: initial } = renderHook(() => useViraPassword({ policy, inputProps: { defaultValue: STRONG } }));
    expect(initial.current.strength?.level).toBe("strong");
    const { result: numeric } = renderHook(() => useViraPassword({ policy, inputProps: { defaultValue: 5 } }));
    expect(numeric.current.strength?.length).toBe(0);
  });

  it("follows a native form reset", async () => {
    function Resettable() {
      const pw = useViraPassword({ policy, inputProps: { defaultValue: "" } });
      return (
        <form>
          <input aria-label="Password" {...pw.inputProps} />
          <p {...pw.strengthProps}>{pw.strength?.level}</p>
          <button type="reset">Reset</button>
        </form>
      );
    }
    render(<Resettable />);
    await userEvent.type(input(), STRONG);
    expect(screen.getByRole("status")).toHaveTextContent("strong");
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("weak"));
  });

  it("ignores resets of other forms", async () => {
    function Two() {
      const pw = useViraPassword({ policy });
      return (
        <>
          <form>
            <input aria-label="Password" {...pw.inputProps} />
            <p {...pw.strengthProps}>{pw.strength?.level}</p>
          </form>
          <form>
            <button type="reset">Reset other</button>
          </form>
        </>
      );
    }
    render(<Two />);
    await userEvent.type(input(), STRONG);
    await userEvent.click(screen.getByRole("button", { name: "Reset other" }));
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.getByRole("status")).toHaveTextContent("strong");
  });
});

describe("rule", () => {
  it("is stable and checks the latest policy and forbidden values", () => {
    const { result, rerender } = renderHook((options: UseViraPasswordOptions) => useViraPassword(options), {
      initialProps: { policy } as UseViraPasswordOptions,
    });
    const first = result.current.rule;
    expect(first.validate("short")).toBe("password.tooShort");
    expect(first.validate(STRONG)).toBe(true);
    expect(first.validate(undefined)).toBe("password.tooShort");
    rerender({ policy: definePolicy({ minLength: 4 }), forbidden: ["kq2mz"] });
    expect(result.current.rule).toBe(first);
    expect(first.validate("short")).toBe(true);
    expect(first.validate("xx-kq2mz-yy")).toBe("password.containsPersonalInfo");
  });
});

type Values = { email: string; password: string };

describe("React Hook Form", () => {
  it("register() through inputProps, value from watch()", async () => {
    let form!: UseFormReturn<Values>;
    function Signup() {
      form = useForm<Values>({ defaultValues: { email: "omer@example.com", password: "" } });
      const pw = useViraPassword({
        policy,
        value: form.watch("password"),
        forbidden: [form.watch("email")],
        inputProps: form.register("password"),
      });
      return (
        <form onSubmit={form.handleSubmit(() => {})}>
          <input aria-label="Password" {...pw.inputProps} />
          <p {...pw.strengthProps}>{pw.strength?.level}</p>
          <button {...pw.btnProps} />
        </form>
      );
    }
    render(<Signup />);
    await userEvent.type(input(), STRONG);
    expect(form.getValues("password")).toBe(STRONG);
    expect(screen.getByRole("status")).toHaveTextContent("strong");
    expect(input()).toHaveAttribute("name", "password");

    act(() => form.setValue("password", "abc"));
    expect(input().value).toBe("abc");
    expect(screen.getByRole("status")).toHaveTextContent("weak");

    act(() => form.reset({ email: "x@example.com", password: STRONG }));
    expect(input().value).toBe(STRONG);
    expect(screen.getByRole("status")).toHaveTextContent("strong");

    // reset(values) made those the new defaults.
    act(() => form.reset());
    expect(input().value).toBe(STRONG);
    act(() => form.reset({ email: "", password: "" }));
    expect(input().value).toBe("");
    expect(screen.getByRole("status")).toHaveTextContent("weak");
  });

  it("validates with pw.rule through mergeProps and shows the key", async () => {
    function Signup() {
      const form = useForm<Values>({ defaultValues: { email: "", password: "" }, mode: "onChange" });
      const pw = useViraPassword({ policy, value: form.watch("password") });
      return (
        <form onSubmit={form.handleSubmit(() => {})}>
          <input aria-label="Password" {...mergeProps(pw.inputProps, form.register("password", pw.rule))} />
          <button {...pw.btnProps} />
          <p role="alert">{form.formState.errors.password?.message}</p>
        </form>
      );
    }
    render(<Signup />);
    await userEvent.type(input(), "short");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("password.tooShort"));
    await userEvent.type(input(), "-but-now-long-enough");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(""));
    // mergeProps kept our handlers: the toggle still returns focus to the input.
    await userEvent.click(screen.getByRole("button", { name: "Toggle password visibility" }));
    expect(input().type).toBe("text");
    expect(document.activeElement).toBe(input());
  });

  it("works with Controller", async () => {
    let form!: UseFormReturn<Values>;
    function Signup() {
      form = useForm<Values>({ defaultValues: { email: "", password: "" } });
      return (
        <Controller
          control={form.control}
          name="password"
          render={({ field }) => <Inner field={field} />}
        />
      );
    }
    function Inner({ field }: { field: { value: string; onChange: (v: string) => void; onBlur: () => void; name: string; ref: (el: HTMLInputElement | null) => void } }) {
      const pw = useViraPassword({
        policy,
        value: field.value,
        inputProps: { ...field, onChange: (e) => field.onChange(e.target.value) },
      });
      return (
        <>
          <input aria-label="Password" {...pw.inputProps} />
          <p {...pw.strengthProps}>{pw.strength?.level}</p>
        </>
      );
    }
    render(<Signup />);
    await userEvent.type(input(), STRONG);
    expect(form.getValues("password")).toBe(STRONG);
    expect(screen.getByRole("status")).toHaveTextContent("strong");
    act(() => form.reset({ email: "", password: "" }));
    expect(input().value).toBe("");
    expect(screen.getByRole("status")).toHaveTextContent("weak");
  });

  it("works with a Zod resolver using the same policy", async () => {
    const schema = z.object({
      email: z.email(),
      password: z.string().superRefine((value, ctx) => {
        const result = evaluate(value, policy);
        for (const issue of result.issues) ctx.addIssue({ code: "custom", message: issue });
      }),
    });
    let submitted: Values | undefined;
    function Signup() {
      const form = useForm<Values>({ defaultValues: { email: "a@b.co", password: "" }, resolver: zodResolver(schema) });
      const pw = useViraPassword({ policy, value: form.watch("password"), inputProps: form.register("password") });
      return (
        <form onSubmit={form.handleSubmit((values) => (submitted = values))}>
          <input aria-label="Password" {...pw.inputProps} />
          <button {...pw.btnProps} />
          <button type="submit">Submit</button>
          <p role="alert">{form.formState.errors.password?.message}</p>
          <p data-testid="dirty">{String(form.formState.isDirty)}</p>
        </form>
      );
    }
    render(<Signup />);
    await userEvent.click(screen.getByRole("button", { name: "Toggle password visibility" }));
    await userEvent.type(input(), "passwordpassword");
    expect(screen.getByTestId("dirty")).toHaveTextContent("true");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("password.common"));
    // Submitting hid the password.
    expect(input().type).toBe("password");
    expect(submitted).toBeUndefined();
    await userEvent.clear(input());
    await userEvent.type(input(), STRONG);
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(submitted).toEqual({ email: "a@b.co", password: STRONG }));
  });
});
