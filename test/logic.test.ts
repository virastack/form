import { describe, expect, it, vi } from "vitest";
import { getButtonAriaAttributes, getInputAriaAttributes, getInputType, mergeProps } from "../src";

describe("logic", () => {
  it("maps visibility to the input type", () => {
    expect(getInputType(true)).toBe("text");
    expect(getInputType(false)).toBe("password");
  });

  it("builds button attributes", () => {
    expect(getButtonAriaAttributes(true, "pw", "Show")).toEqual({
      "aria-label": "Show",
      "aria-pressed": true,
      "aria-controls": "pw",
      type: "button",
    });
  });

  it("only sets the input attributes it gets", () => {
    expect(getInputAriaAttributes()).toStrictEqual({});
    expect(getInputAriaAttributes(undefined, "")).toStrictEqual({});
    expect(getInputAriaAttributes(false)).toStrictEqual({ "aria-invalid": false });
    expect(getInputAriaAttributes(true, "hint")).toEqual({ "aria-invalid": true, "aria-describedby": "hint" });
  });
});

describe("mergeProps", () => {
  it("chains handlers in order", () => {
    const calls: string[] = [];
    const merged = mergeProps<{ onClick?: (n: number) => void }>(
      { onClick: (n) => calls.push(`a${n}`) },
      undefined,
      { onClick: (n) => calls.push(`b${n}`) },
    );
    merged.onClick?.(1);
    expect(calls).toEqual(["a1", "b1"]);
  });

  it("joins class names and lets later values win", () => {
    expect(mergeProps<{ className?: string; id?: string }>({ className: "a", id: "x" }, { className: "b", id: "y" })).toEqual({
      className: "a b",
      id: "y",
    });
  });

  it("a later undefined handler wins and is not called", () => {
    const fn = vi.fn();
    const merged = mergeProps<{ onClick?: () => void }>({ onClick: fn }, { onClick: undefined });
    expect(merged.onClick).toBeUndefined();
  });

  it("joins aria-describedby, skips empty class names, lets a non-string win", () => {
    expect(mergeProps<{ "aria-describedby"?: string }>({ "aria-describedby": "a" }, { "aria-describedby": "b" })).toEqual({
      "aria-describedby": "a b",
    });
    expect(mergeProps<{ className?: string }>({ className: "a" }, { className: "" })).toEqual({ className: "a" });
    expect(mergeProps<{ className?: string }>({ className: "a" }, { className: undefined })).toEqual({ className: undefined });
    expect(mergeProps<{ title?: string }>({ title: "a" }, { title: "b" })).toEqual({ title: "b" });
  });

  it("replaces a non-function with a handler", () => {
    const fn = vi.fn();
    const merged = mergeProps<{ onClick?: unknown }>({ onClick: "x" }, { onClick: fn });
    expect(merged.onClick).toBe(fn);
  });
});
