// Real Chromium, Firefox and WebKit through Playwright: focus, selection, keyboard and forms behave like in the browser.
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { page, server, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { mergeProps, useViraPassword } from "../../src";
import { definePolicy } from "../../src/strength";

const policy = definePolicy();
const STRONG = "vu7#Kq2!mz9@Lw4X";

function Signup({ onNativeSubmit }: { onNativeSubmit?: (type: string) => void }) {
  const form = useForm({ defaultValues: { email: "", password: "", confirm: "" } });
  const password = form.watch("password");
  const pw = useViraPassword({ policy, value: password, forbidden: [form.watch("email")] });
  const confirm = useViraPassword({ matchWith: password, value: form.watch("confirm") });
  return (
    <form
      ref={(el) => {
        if (!el || !onNativeSubmit) return;
        // Like a password manager: a plain listener reading the field when the form submits.
        const listener = () => onNativeSubmit((el.elements.namedItem("password") as HTMLInputElement).type);
        el.addEventListener("submit", listener);
        return () => el.removeEventListener("submit", listener);
      }}
      onSubmit={form.handleSubmit(() => {})}
    >
      <label>
        Email <input type="email" autoComplete="username" {...form.register("email")} />
      </label>
      <label>
        Password <input {...mergeProps(pw.inputProps, form.register("password", pw.rule))} />
      </label>
      <button {...pw.btnProps} aria-label="Show password" />
      <p {...pw.strengthProps}>{pw.strength?.level}</p>
      {pw.capsLock && <p>Caps Lock is on</p>}
      <label>
        Confirm <input {...mergeProps(confirm.inputProps, form.register("confirm", confirm.rule))} />
      </label>
      <p data-testid="matches">{String(confirm.matches)}</p>
      <button type="submit">Sign up</button>
    </form>
  );
}

const field = (label: string) => page.getByLabelText(label, { exact: true }).element() as HTMLInputElement;
const toggle = () => page.getByRole("button", { name: "Show password" });

describe("in a real browser", () => {
  it("a click shows the password and returns focus and the caret to the input", async () => {
    await render(<Signup />);
    await userEvent.type(page.getByLabelText("Password", { exact: true }), "hunter22-long-one");
    field("Password").setSelectionRange(3, 6);
    await userEvent.click(toggle());
    expect(field("Password").type).toBe("text");
    expect(toggle().element()).toHaveAttribute("aria-pressed", "true");
    expect(document.activeElement).toBe(field("Password"));
    expect([field("Password").selectionStart, field("Password").selectionEnd]).toEqual([3, 6]);
    // Typing goes on at the caret.
    await userEvent.keyboard("X");
    expect(field("Password").value).toBe("hunX22-long-one");
  });

  it("Enter and Space on the focused toggle keep focus on it", async () => {
    await render(<Signup />);
    (toggle().element() as HTMLButtonElement).focus();
    await userEvent.keyboard("{Enter}");
    expect(field("Password").type).toBe("text");
    expect(document.activeElement).toBe(toggle().element());
    await userEvent.keyboard(" ");
    expect(field("Password").type).toBe("password");
    expect(document.activeElement).toBe(toggle().element());
  });

  it("Tab order: input, toggle, next field", async () => {
    await render(<Signup />);
    await userEvent.click(page.getByLabelText("Password", { exact: true }));
    await userEvent.tab();
    // WebKit (Safari) skips buttons on Tab unless "Tab to all controls" is on; Option+Tab reaches them.
    if (server.browser === "webkit") {
      expect(document.activeElement).toBe(field("Confirm"));
      return;
    }
    expect(document.activeElement).toBe(toggle().element());
    await userEvent.tab();
    expect(document.activeElement).toBe(field("Confirm"));
  });

  it("the field is a password field again when a password manager reads the submit", async () => {
    const seen: string[] = [];
    await render(<Signup onNativeSubmit={(type) => seen.push(type)} />);
    await userEvent.type(page.getByLabelText("Password", { exact: true }), STRONG);
    await userEvent.click(toggle());
    expect(field("Password").type).toBe("text");
    await userEvent.click(page.getByRole("button", { name: "Sign up" }));
    expect(seen).toEqual(["password"]);
    expect(field("Password").type).toBe("password");
  });

  it("autocomplete hints for password managers", async () => {
    await render(<Signup />);
    // Password managers read the attribute; Firefox's autocomplete property returns "" for these tokens.
    expect(field("Password").getAttribute("autocomplete")).toBe("new-password");
    expect(field("Confirm").getAttribute("autocomplete")).toBe("new-password");
    expect(field("Password").getAttribute("spellcheck")).toBe("false");
  });

  it("allows pasting", async () => {
    await render(<Signup />);
    const input = field("Password");
    input.focus();
    const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: new DataTransfer() });
    event.clipboardData?.setData("text/plain", STRONG);
    input.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    await userEvent.fill(page.getByLabelText("Password", { exact: true }), STRONG);
    await expect.element(page.getByRole("status")).toHaveTextContent("strong");
  });

  it("announces strength through a polite live region", async () => {
    await render(<Signup />);
    const status = page.getByRole("status");
    await expect.element(status).toHaveAttribute("aria-live", "polite");
    expect(field("Password").getAttribute("aria-describedby")).toBe(status.element().id);
    await userEvent.type(page.getByLabelText("Password", { exact: true }), "short");
    await expect.element(status).toHaveTextContent("weak");
    await userEvent.type(page.getByLabelText("Password", { exact: true }), "-and-then-much-longer-X9");
    await expect.element(status).toHaveTextContent("strong");
  });

  it("confirm follows both fields", async () => {
    await render(<Signup />);
    await userEvent.type(page.getByLabelText("Password", { exact: true }), STRONG);
    await userEvent.type(page.getByLabelText("Confirm", { exact: true }), STRONG);
    await expect.element(page.getByTestId("matches")).toHaveTextContent("true");
    await userEvent.type(page.getByLabelText("Password", { exact: true }), "!");
    await expect.element(page.getByTestId("matches")).toHaveTextContent("false");
  });

  it("detects Caps Lock from real key events", async () => {
    await render(<Signup />);
    const input = field("Password");
    input.focus();
    // Synthetic events with the modifier flag; real CapsLock state is not scriptable in every browser.
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "A", bubbles: true, modifierCapsLock: true } as KeyboardEventInit));
    await expect.element(page.getByText("Caps Lock is on")).toBeInTheDocument();
    input.dispatchEvent(new KeyboardEvent("keyup", { key: "a", bubbles: true }));
    await expect.element(page.getByText("Caps Lock is on")).not.toBeInTheDocument();
  });
});
