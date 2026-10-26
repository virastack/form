import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState, type FormEvent } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";
import { composeRefs, useViraPassword, type UseViraPasswordOptions } from "../src";
import { definePolicy } from "../src/strength";

const policy = definePolicy();

function Field(props: UseViraPasswordOptions & { onSubmit?: (event: FormEvent) => void; onCaps?: (on: boolean) => void }) {
  const { onSubmit = (e) => e.preventDefault(), onCaps, ...options } = props;
  const pw = useViraPassword(options);
  onCaps?.(pw.capsLock);
  return (
    <form onSubmit={onSubmit}>
      <label htmlFor={pw.inputProps.id}>Password</label>
      <input {...pw.inputProps} />
      <button {...pw.btnProps} />
      <input aria-label="Other" />
      <button type="submit">Submit</button>
      <button type="reset">Reset</button>
      {pw.capsLock && <p>Caps Lock is on</p>}
    </form>
  );
}

const input = () => screen.getByLabelText("Password") as HTMLInputElement;
const toggleButton = () => screen.getByRole("button", { name: "Toggle password visibility" });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("input attributes", () => {
  it("defaults to current-password and turns off text helpers", () => {
    render(<Field />);
    expect(input()).toHaveAttribute("autocomplete", "current-password");
    expect(input()).toHaveAttribute("spellcheck", "false");
    expect(input()).toHaveAttribute("autocorrect", "off");
    expect(input()).toHaveAttribute("autocapitalize", "off");
  });

  it("takes another autoComplete, or none", () => {
    const { unmount } = render(<Field autoComplete="new-password" />);
    expect(input()).toHaveAttribute("autocomplete", "new-password");
    unmount();
    render(<Field autoComplete={false} />);
    expect(input()).not.toHaveAttribute("autocomplete");
  });

  it("lets inputProps override the defaults", () => {
    render(<Field inputProps={{ autoComplete: "one-time-code", spellCheck: true }} />);
    expect(input()).toHaveAttribute("autocomplete", "one-time-code");
    expect(input()).toHaveAttribute("spellcheck", "true");
  });
});

describe("hiding on submit and reset", () => {
  it("hides when the form is submitted", async () => {
    const onSubmit = vi.fn((e: FormEvent) => {
      // The field is already a password field when the submit handler runs.
      expect(input().type).toBe("password");
      e.preventDefault();
    });
    render(<Field defaultVisible onSubmit={onSubmit} />);
    expect(input().type).toBe("text");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(input().type).toBe("password");
  });

  it("is a password field again before a native submission reads the form", () => {
    render(<Field defaultVisible />);
    // A plain dispatch, outside act(): nothing flushes React for us.
    vi.spyOn(console, "error").mockImplementation(() => {});
    input().form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(input().type).toBe("password");
  });

  it("hides on Enter in the field", async () => {
    render(<Field defaultVisible />);
    await userEvent.type(input(), "secret{Enter}");
    expect(input().type).toBe("password");
  });

  it("can be turned off", async () => {
    render(<Field defaultVisible hideOnSubmit={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(input().type).toBe("text");
  });

  it("hides on reset unless reset is prevented", async () => {
    const { unmount } = render(<Field defaultVisible />);
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(input().type).toBe("password");
    unmount();

    function Prevented() {
      const pw = useViraPassword({ defaultVisible: true });
      return (
        <form onReset={(e) => e.preventDefault()}>
          <input aria-label="Password" {...pw.inputProps} />
          <button type="reset">Reset</button>
        </form>
      );
    }
    render(<Prevented />);
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(input().type).toBe("text");
  });

  it("ignores other forms", async () => {
    function Two() {
      const pw = useViraPassword({ defaultVisible: true });
      return (
        <>
          <form>
            <input aria-label="Password" {...pw.inputProps} />
          </form>
          <form onSubmit={(e) => e.preventDefault()}>
            <button type="submit">Other submit</button>
          </form>
        </>
      );
    }
    render(<Two />);
    await userEvent.click(screen.getByRole("button", { name: "Other submit" }));
    expect(input().type).toBe("text");
  });

  it("does nothing outside a form", () => {
    function Bare() {
      const pw = useViraPassword({ defaultVisible: true });
      return <input aria-label="Password" {...pw.inputProps} />;
    }
    render(<Bare />);
    fireEvent.submit(document.body);
    expect(input().type).toBe("text");
  });

  it("finds the input by id when a later ref replaces ours", async () => {
    function Overridden() {
      const pw = useViraPassword({ defaultVisible: true });
      const ref = createRef<HTMLInputElement>();
      return (
        <form onSubmit={(e) => e.preventDefault()}>
          <input aria-label="Password" {...pw.inputProps} ref={ref} />
          <button type="submit">Submit</button>
        </form>
      );
    }
    render(<Overridden />);
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(input().type).toBe("password");
  });

  it("hides even when disabled", () => {
    render(<Field defaultVisible disabled />);
    fireEvent.submit(input().form!);
    expect(input().type).toBe("password");
  });
});

describe("focus", () => {
  it("returns focus and the caret to the input after a mouse press", async () => {
    render(<Field />);
    await userEvent.type(input(), "hunter22");
    input().setSelectionRange(2, 4);
    await userEvent.click(toggleButton());
    expect(input().type).toBe("text");
    expect(document.activeElement).toBe(input());
    expect([input().selectionStart, input().selectionEnd]).toEqual([2, 4]);
  });

  it("keeps focus on the button for keyboard presses", async () => {
    render(<Field />);
    await userEvent.click(input());
    await userEvent.tab();
    expect(document.activeElement).toBe(toggleButton());
    await userEvent.keyboard("{Enter}");
    expect(input().type).toBe("text");
    expect(document.activeElement).toBe(toggleButton());
    await userEvent.keyboard(" ");
    expect(input().type).toBe("password");
    expect(document.activeElement).toBe(toggleButton());
  });

  it("forgets a press that was released outside the button", async () => {
    vi.useFakeTimers();
    try {
      render(<Field />);
      fireEvent.pointerDown(toggleButton());
      fireEvent.pointerUp(window);
      act(() => vi.runAllTimers());
      toggleButton().focus();
      fireEvent.click(toggleButton());
      expect(input().type).toBe("text");
      expect(document.activeElement).toBe(toggleButton());
    } finally {
      vi.useRealTimers();
    }
  });

  it("forgets a cancelled press", () => {
    render(<Field />);
    fireEvent.pointerDown(toggleButton());
    fireEvent.pointerCancel(toggleButton());
    toggleButton().focus();
    fireEvent.click(toggleButton());
    expect(document.activeElement).toBe(toggleButton());
  });

  it("works without a caret position", () => {
    render(<Field />);
    vi.spyOn(input(), "selectionStart", "get").mockReturnValue(null);
    fireEvent.pointerDown(toggleButton());
    fireEvent.click(toggleButton());
    expect(document.activeElement).toBe(input());
  });
});

describe("controlled visibility", () => {
  it("follows the visible prop and reports changes", async () => {
    const onVisibleChange = vi.fn();
    function Controlled() {
      const [visible, setVisible] = useState(false);
      return (
        <Field
          visible={visible}
          onVisibleChange={(next) => {
            onVisibleChange(next);
            setVisible(next);
          }}
        />
      );
    }
    render(<Controlled />);
    await userEvent.click(toggleButton());
    expect(onVisibleChange).toHaveBeenLastCalledWith(true);
    expect(input().type).toBe("text");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onVisibleChange).toHaveBeenLastCalledWith(false);
    expect(input().type).toBe("password");
  });

  it("stays put when the parent ignores the change", async () => {
    const onVisibleChange = vi.fn();
    render(<Field visible={false} onVisibleChange={onVisibleChange} />);
    await userEvent.click(toggleButton());
    expect(onVisibleChange).toHaveBeenCalledWith(true);
    expect(input().type).toBe("password");
  });

  it("keeps its own state while controlled", async () => {
    const { rerender } = render(<Field visible={false} onVisibleChange={() => {}} />);
    await userEvent.click(toggleButton());
    rerender(<Field />);
    expect(input().type).toBe("password");
  });

  it("links two fields through one state", async () => {
    function Pair() {
      const [visible, setVisible] = useState(false);
      const a = useViraPassword({ visible, onVisibleChange: setVisible, id: "a" });
      const b = useViraPassword({ visible, onVisibleChange: setVisible, id: "b" });
      return (
        <>
          <input aria-label="A" {...a.inputProps} />
          <input aria-label="B" {...b.inputProps} />
          <button {...a.btnProps} aria-label="Toggle A" />
        </>
      );
    }
    render(<Pair />);
    await userEvent.click(screen.getByRole("button", { name: "Toggle A" }));
    expect((screen.getByLabelText("A") as HTMLInputElement).type).toBe("text");
    expect((screen.getByLabelText("B") as HTMLInputElement).type).toBe("text");
  });

  it("does not report a change that is no change", () => {
    const onVisibleChange = vi.fn();
    let pw!: ReturnType<typeof useViraPassword>;
    function Probe() {
      pw = useViraPassword({ onVisibleChange });
      return null;
    }
    render(<Probe />);
    act(() => pw.setVisible(false));
    expect(onVisibleChange).not.toHaveBeenCalled();
  });
});

describe("Caps Lock", () => {
  it("tracks the modifier while typing and clears on blur", () => {
    render(<Field />);
    expect(screen.queryByText("Caps Lock is on")).toBeNull();
    fireEvent.keyDown(input(), { key: "A", modifierCapsLock: true });
    expect(screen.getByText("Caps Lock is on")).toBeInTheDocument();
    fireEvent.keyUp(input(), { key: "CapsLock", modifierCapsLock: false });
    expect(screen.queryByText("Caps Lock is on")).toBeNull();
    fireEvent.keyDown(input(), { key: "A", modifierCapsLock: true });
    fireEvent.blur(input());
    expect(screen.queryByText("Caps Lock is on")).toBeNull();
  });

  it("treats a missing getModifierState as off", () => {
    render(<Field />);
    const event = new KeyboardEvent("keydown", { bubbles: true });
    Object.defineProperty(event, "getModifierState", { value: undefined });
    fireEvent(input(), event);
    expect(screen.queryByText("Caps Lock is on")).toBeNull();
  });
});

describe("hideOnBlur", () => {
  it("is off by default", async () => {
    render(<Field defaultVisible />);
    await userEvent.click(input());
    await userEvent.click(screen.getByLabelText("Other"));
    expect(input().type).toBe("text");
  });

  it("hides when focus leaves the input and the toggle", async () => {
    render(<Field defaultVisible hideOnBlur />);
    await userEvent.click(input());
    await userEvent.tab();
    expect(document.activeElement).toBe(toggleButton());
    expect(input().type).toBe("text");
    await userEvent.tab();
    expect(input().type).toBe("password");
  });

  it("does not hide on the blur caused by pressing the toggle", async () => {
    render(<Field defaultVisible hideOnBlur />);
    await userEvent.click(input());
    // Safari does not focus buttons on click, so the input blurs with no related target.
    // Hiding there would make the click show the password again.
    fireEvent.pointerDown(toggleButton());
    fireEvent.blur(input(), { relatedTarget: null });
    fireEvent.click(toggleButton());
    expect(input().type).toBe("password");
  });

  it("hides when the browser tab is hidden", () => {
    render(<Field defaultVisible hideOnBlur />);
    const state = vi.spyOn(document, "visibilityState", "get");
    state.mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    expect(input().type).toBe("text");
    state.mockReturnValue("hidden");
    fireEvent(document, new Event("visibilitychange"));
    expect(input().type).toBe("password");
  });

  it("keeps the field visible while focus moves between the input and the toggle", () => {
    render(<Field defaultVisible hideOnBlur />);
    fireEvent.blur(input(), { relatedTarget: toggleButton() });
    fireEvent.blur(toggleButton(), { relatedTarget: input() });
    expect(input().type).toBe("text");
    fireEvent.blur(input(), { relatedTarget: screen.getByLabelText("Other") });
    expect(input().type).toBe("password");
  });

  it("hides from the button when focus goes elsewhere", () => {
    render(<Field defaultVisible hideOnBlur />);
    fireEvent.blur(toggleButton(), { relatedTarget: screen.getByLabelText("Other") });
    expect(input().type).toBe("password");
  });
});

describe("disabled and readOnly", () => {
  it.each(["disabled", "readOnly"] as const)("%s blocks the toggle", async (state) => {
    render(<Field {...{ [state]: true }} />);
    expect(toggleButton()).toBeDisabled();
    fireEvent.click(toggleButton());
    expect(input().type).toBe("password");
  });

  it("a click that lands while disabled does nothing", () => {
    render(<Field disabled btnProps={{ disabled: false }} />);
    fireEvent.click(toggleButton());
    expect(input().type).toBe("password");
  });
});

describe("user props", () => {
  it("calls the user's handlers and refs", async () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    const onKeyDown = vi.fn();
    const onClick = vi.fn();
    const objectRef = createRef<HTMLInputElement>();
    render(<Field inputProps={{ onChange, onBlur, onKeyDown, ref: objectRef }} btnProps={{ onClick }} />);
    await userEvent.type(input(), "ab");
    await userEvent.click(toggleButton());
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onKeyDown).toHaveBeenCalledTimes(2);
    expect(onBlur).toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledOnce();
    expect(objectRef.current).toBe(input());
  });

  it("works with a register()-style callback ref", async () => {
    const register = vi.fn();
    const { unmount } = render(<Field inputProps={{ name: "password", ref: register }} />);
    expect(register).toHaveBeenLastCalledWith(input());
    expect(input()).toHaveAttribute("name", "password");
    unmount();
    expect(register.mock.lastCall?.[0]).toBeNull();
  });
});

describe("attribute-only inputProps (regression: 1.1 must not break 1.0 spreads)", () => {
  it("has no ref and no handlers of its own", () => {
    let pw!: ReturnType<typeof useViraPassword>;
    function Probe() {
      pw = useViraPassword({ policy: undefined, matchWith: "x" });
      return null;
    }
    render(<Probe />);
    expect(pw.inputProps).not.toHaveProperty("ref");
    expect(Object.values(pw.inputProps).filter((value) => typeof value === "function")).toEqual([]);
  });

  it("keeps register()'s ref and onBlur when spread after register()", async () => {
    let form!: UseFormReturn<{ password: string }>;
    function Login() {
      form = useForm({ defaultValues: { password: "" }, mode: "onBlur" });
      const pw = useViraPassword({ hideOnBlur: true, defaultVisible: true });
      return (
        <form>
          {/* the 1.0 pattern: register first, inputProps after */}
          <input aria-label="Password" {...form.register("password", { required: "password.required" })} {...pw.inputProps} />
          <input aria-label="Other" />
          {pw.capsLock && <p>Caps Lock is on</p>}
          <p role="alert">{form.formState.errors.password?.message}</p>
        </form>
      );
    }
    render(<Login />);
    // ref kept: setValue writes to the DOM
    act(() => form.setValue("password", "from-code"));
    expect(input().value).toBe("from-code");
    // onBlur kept: mode "onBlur" validates
    act(() => form.setValue("password", ""));
    await userEvent.click(input());
    fireEvent.keyDown(input(), { key: "A", modifierCapsLock: true });
    expect(screen.getByText("Caps Lock is on")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Other"));
    expect(await screen.findByRole("alert")).toHaveTextContent("password.required");
    // and the hook still saw the blur
    expect(screen.queryByText("Caps Lock is on")).toBeNull();
    expect(input().type).toBe("password");
  });

  it("follows typing when register()'s onChange comes after", async () => {
    function Signup() {
      const form = useForm({ defaultValues: { password: "" } });
      const pw = useViraPassword({ policy });
      return (
        <>
          <input aria-label="Password" {...pw.inputProps} {...form.register("password")} />
          <p data-testid="level">{pw.strength?.level}</p>
        </>
      );
    }
    render(<Signup />);
    await userEvent.type(input(), "vu7#Kq2!mz9@Lw4X");
    expect(screen.getByTestId("level")).toHaveTextContent("strong");
  });

  it("uses inputProps.id for aria-controls and lookups", async () => {
    render(<Field defaultVisible inputProps={{ id: "custom-id" }} />);
    expect(input().id).toBe("custom-id");
    expect(toggleButton()).toHaveAttribute("aria-controls", "custom-id");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(input().type).toBe("password");
  });
});

describe("composeRefs", () => {
  it("sets every ref and runs React 19 cleanups", () => {
    const cleanup = vi.fn();
    const withCleanup = vi.fn(() => cleanup);
    const plain = vi.fn();
    const object = createRef<HTMLElement>();
    const ref = composeRefs<HTMLElement>(withCleanup, plain, object, null, undefined);
    const node = document.createElement("input");
    const dispose = ref(node);
    expect(withCleanup).toHaveBeenCalledWith(node);
    expect(plain).toHaveBeenCalledWith(node);
    expect(object.current).toBe(node);
    expect(typeof dispose).toBe("function");
    (dispose as () => void)();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(plain).toHaveBeenLastCalledWith(null);
    expect(object.current).toBeNull();
  });

  it("returns nothing when no ref has a cleanup", () => {
    const ref = composeRefs<HTMLElement>(vi.fn<(node: HTMLElement | null) => void>(), createRef());
    expect(ref(document.createElement("input"))).toBeUndefined();
  });
});
