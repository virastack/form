import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EyeIcon, EyeOffIcon } from "../src";

describe("icons", () => {
  it("render an svg and pass props through", () => {
    const { container } = render(
      <>
        <EyeIcon data-testid="eye" width={24} />
        <EyeOffIcon data-testid="eye-off" />
      </>,
    );
    const [eye, eyeOff] = container.querySelectorAll("svg");
    expect(eye).toHaveAttribute("width", "24");
    expect(eye).toHaveAttribute("stroke", "currentColor");
    expect(eyeOff.querySelectorAll("path")).toHaveLength(4);
  });
});
