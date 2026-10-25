import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useFieldArray, useForm, type UseFormReturn } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { useViraMask } from "../src";

type F = { phones: { number: string }[] };

function MaskedRow({ form, index, onRemove }: { form: UseFormReturn<F>; index: number; onRemove: () => void }) {
  const { number } = useViraMask(form, { number: { name: `phones.${index}.number`, preset: "phone", country: "TR" } });
  return (
    <div>
      <input aria-label={`phone ${index}`} {...number} />
      <button type="button" onClick={onRemove}>
        remove {index}
      </button>
    </div>
  );
}

function setup(shouldUnregister = false) {
  const api = {} as { form: UseFormReturn<F>; swap: (a: number, b: number) => void };
  const onSubmit = vi.fn();
  function Form() {
    const form = useForm<F>({ shouldUnregister, defaultValues: { phones: [{ number: "5551112233" }] } });
    const { fields, append, remove, swap } = useFieldArray({ control: form.control, name: "phones" });
    api.form = form;
    api.swap = swap;
    return (
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {fields.map((field, index) => (
          <MaskedRow key={field.id} form={form} index={index} onRemove={() => remove(index)} />
        ))}
        <button type="button" onClick={() => append({ number: "" })}>
          add
        </button>
        <button type="submit">submit</button>
      </form>
    );
  }
  render(<Form />);
  return { api, onSubmit, user: userEvent.setup() };
}

const phone = (index: number) => screen.getByLabelText<HTMLInputElement>(`phone ${index}`);

describe("useFieldArray", () => {
  it("masks appended rows and submits raw values", async () => {
    const { user, onSubmit } = setup();
    expect(phone(0).value).toBe("(555) 111 22 33");
    await user.click(screen.getByText("add"));
    await user.type(phone(1), "5324445566");
    expect(phone(1).value).toBe("(532) 444 55 66");
    await user.click(screen.getByText("add"));
    await user.type(phone(2), "5427778899");
    await user.click(screen.getByText("submit"));
    expect(onSubmit).toHaveBeenCalledWith(
      { phones: [{ number: "5551112233" }, { number: "5324445566" }, { number: "5427778899" }] },
      expect.anything(),
    );
  });

  it("keeps values and display when a row above is removed", async () => {
    const { user, api, onSubmit } = setup();
    await user.click(screen.getByText("add"));
    await user.type(phone(1), "5324445566");
    await user.click(screen.getByText("add"));
    await user.type(phone(2), "5427778899");

    await user.click(screen.getByText("remove 0"));
    expect(phone(0).value).toBe("(532) 444 55 66");
    expect(phone(1).value).toBe("(542) 777 88 99");
    expect(api.form.getValues("phones")).toEqual([{ number: "5324445566" }, { number: "5427778899" }]);

    // editing the shifted row still writes to the right index
    await user.clear(phone(1));
    await user.type(phone(1), "5001234567");
    await user.click(screen.getByText("submit"));
    expect(onSubmit).toHaveBeenCalledWith(
      { phones: [{ number: "5324445566" }, { number: "5001234567" }] },
      expect.anything(),
    );
  });

  it("swaps rows", async () => {
    const { user, api } = setup();
    await user.click(screen.getByText("add"));
    await user.type(phone(1), "5324445566");
    act(() => api.swap(0, 1));
    await waitFor(() => expect(phone(0).value).toBe("(532) 444 55 66"));
    expect(phone(1).value).toBe("(555) 111 22 33");
    expect(api.form.getValues("phones")).toEqual([{ number: "5324445566" }, { number: "5551112233" }]);
  });

  it("validates each row", async () => {
    const { user, api } = setup();
    await user.click(screen.getByText("add"));
    await user.type(phone(1), "532");
    await user.click(screen.getByText("submit"));
    expect(api.form.getFieldState("phones.1.number").error?.message).toBe("phone.incomplete");
    expect(api.form.getFieldState("phones.0.number").error).toBeUndefined();
  });

  it("removes values with shouldUnregister", async () => {
    const { user, api } = setup(true);
    await user.click(screen.getByText("add"));
    await user.type(phone(1), "5324445566");
    await user.click(screen.getByText("remove 0"));
    expect(api.form.getValues("phones")).toEqual([{ number: "5324445566" }]);
  });
});
