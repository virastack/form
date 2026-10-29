// Mask, password and address against the React Hook Form features real forms use:
// submit, edit forms loaded later, reset(), setValue(), resolvers, FormProvider,
// field arrays, unmounting and StrictMode. Runs against the workspace builds.
import { zodResolver } from "@hookform/resolvers/zod";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, useEffect, useState, type ReactNode } from "react";
import {
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
  useFormState,
  type Control,
  type FieldValues,
  type UseFormProps,
  type UseFormReturn,
} from "react-hook-form";
import { maskResolver, useViraMask } from "@virastack/mask";
import { mergeProps, useViraPassword } from "@virastack/password";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { useViraAddress } from "../src/index.js";
import { makeSource } from "./fixture.js";

interface Checkout {
  tckn: string;
  phone: string;
  password: string;
  confirm: string;
  province: string;
  district: string;
  neighbourhood: string;
  postalCode: string;
}

const EMPTY: Checkout = {
  tckn: "",
  phone: "",
  password: "",
  confirm: "",
  province: "",
  district: "",
  neighbourhood: "",
  postalCode: "",
};
const STRONG = "vu7#Kq2!mz9@Lw4X";
const SAVED: Checkout = {
  tckn: "10000000146",
  phone: "5551234567",
  password: STRONG,
  confirm: STRONG,
  province: "İSTANBUL",
  district: "FATİH",
  neighbourhood: "AKSARAY MAH.",
  postalCode: "34096",
};
const MASKS = { tckn: { preset: "tckn" }, phone: { preset: "phone", country: "TR" } } as const;
const source = makeSource();

afterEach(cleanup);

/** Dirty and touched state, read the way a component subscribes to it. */
function FormStateProbe<T extends FieldValues>({ control }: { control: Control<T> }) {
  const { isDirty, dirtyFields, touchedFields } = useFormState({ control });
  return <p data-testid="form-state">{JSON.stringify({ isDirty, dirtyFields, touchedFields })}</p>;
}
const formState = () =>
  JSON.parse(screen.getByTestId("form-state").textContent ?? "{}") as {
    isDirty: boolean;
    dirtyFields: object;
    touchedFields: object;
  };
const text = (id: string) => screen.getByTestId(id).textContent ?? "";
const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement & HTMLSelectElement;

/** Every field of the checkout, wired to one form. */
function Fields({ form, onSubmit }: { form: UseFormReturn<Checkout>; onSubmit?: (values: Checkout) => void }) {
  const { tckn, phone } = useViraMask(form, MASKS);
  const password = form.watch("password");
  const pw = useViraPassword({ value: password });
  const confirm = useViraPassword({ matchWith: password, value: form.watch("confirm") });
  const address = useViraAddress({ source, form });
  const { errors } = form.formState;
  return (
    <form onSubmit={form.handleSubmit((values) => onSubmit?.(values))}>
      <input aria-label="TCKN" {...tckn} />
      <input aria-label="Phone" {...phone} />
      <input aria-label="Password" {...mergeProps(pw.inputProps, form.register("password", { ...pw.rule, deps: ["confirm"] }))} />
      <input aria-label="Confirm" {...mergeProps(confirm.inputProps, form.register("confirm", confirm.rule))} />
      <select aria-label="Province" {...address.getProvinceProps()} />
      <select aria-label="District" {...address.getDistrictProps()} />
      <select aria-label="Neighbourhood" {...address.getNeighbourhoodProps()} />
      <p data-testid="errors">{Object.keys(errors).sort().join(",")}</p>
      <p data-testid="tckn-error">{errors.tckn?.message}</p>
      <FormStateProbe control={form.control} />
      <button type="submit">Submit</button>
    </form>
  );
}

function renderCheckout(options: UseFormProps<Checkout> = {}, onSubmit?: (values: Checkout) => void) {
  const ref = { current: null as UseFormReturn<Checkout> | null };
  function Checkout() {
    const form = useForm<Checkout>({ defaultValues: EMPTY, ...options });
    ref.current = form;
    return <Fields form={form} onSubmit={onSubmit} />;
  }
  render(<Checkout />);
  return { form: () => ref.current! };
}

async function fillAll() {
  await userEvent.type(field("TCKN"), "10000000146");
  await userEvent.type(field("Phone"), "05551234567");
  await userEvent.type(field("Password"), STRONG);
  await userEvent.type(field("Confirm"), STRONG);
  await userEvent.selectOptions(field("Province"), "34");
  await waitFor(() => expect(field("District").disabled).toBe(false));
  await userEvent.selectOptions(field("District"), "FATİH");
  await waitFor(() => expect(field("Neighbourhood").disabled).toBe(false));
  await userEvent.selectOptions(field("Neighbourhood"), "AKSARAY MAH.");
}

/** What the user sees for SAVED. */
async function expectSavedOnScreen() {
  await waitFor(() => expect(field("TCKN").value).toBe("10000000146"));
  expect(field("Phone").value).toBe("(555) 123 45 67");
  expect(field("Password").value).toBe(STRONG);
  expect(field("Confirm").value).toBe(STRONG);
  await waitFor(() => expect(field("Neighbourhood").value).toBe("AKSARAY MAH."));
  expect(field("Province").value).toBe("34");
  expect(field("District").value).toBe("FATİH");
}

async function expectEmptyOnScreen() {
  expect(field("TCKN").value).toBe("");
  expect(field("Phone").value).toBe("");
  expect(field("Password").value).toBe("");
  expect(field("Confirm").value).toBe("");
  await waitFor(() => expect(field("Province").value).toBe(""));
  expect(field("District").value).toBe("");
  expect(field("Neighbourhood").value).toBe("");
}

describe("submit", () => {
  it("hands raw values from all three packages to handleSubmit", async () => {
    const onSubmit = vi.fn();
    renderCheckout({}, onSubmit);
    await fillAll();
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0]).toEqual(SAVED);
  });

  it("blocks submit on an invalid TCKN and a mismatched confirmation", async () => {
    const onSubmit = vi.fn();
    renderCheckout({}, onSubmit);
    await fillAll();
    await userEvent.clear(field("TCKN"));
    await userEvent.type(field("TCKN"), "12345678901");
    await userEvent.type(field("Confirm"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(text("errors")).toContain("confirm,tckn"));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("edit forms", () => {
  it("reset(data) after a fetch fills every field and keeps the form pristine", async () => {
    const { form } = renderCheckout();
    act(() => form().reset(SAVED));
    await expectSavedOnScreen();
    expect(form().getValues()).toEqual(SAVED);
    await waitFor(() => expect(formState().isDirty).toBe(false));
    expect(formState().dirtyFields).toEqual({});
    expect(formState().touchedFields).toEqual({});
  });

  it("keeps the saved postal code while the neighbourhoods are still loading", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const slow = makeSource({ neighbourhoods: async (code) => (await gate, source.neighbourhoods(code)) });
    let form!: UseFormReturn<Checkout>;
    function Edit() {
      form = useForm<Checkout>({ defaultValues: EMPTY });
      const address = useViraAddress({ source: slow, form });
      return (
        <>
          <select aria-label="Neighbourhood" {...address.getNeighbourhoodProps()} />
          <FormStateProbe control={form.control} />
        </>
      );
    }
    render(<Edit />);
    act(() => form.reset(SAVED));
    await act(async () => {});
    expect(form.getValues("postalCode")).toBe("34096");
    await act(async () => release());
    await waitFor(() => expect(field("Neighbourhood").value).toBe("AKSARAY MAH."));
    expect(form.getValues("postalCode")).toBe("34096");
    await waitFor(() => expect(formState().isDirty).toBe(false));
  });

  it("the values prop fills every field once the data arrives", async () => {
    function Loader() {
      const [loaded, setLoaded] = useState<Checkout | undefined>();
      useEffect(() => {
        void Promise.resolve().then(() => setLoaded(SAVED));
      }, []);
      const form = useForm<Checkout>({ defaultValues: EMPTY, values: loaded });
      return <Fields form={form} />;
    }
    render(<Loader />);
    await expectSavedOnScreen();
  });

  it("an address typed in another case is matched and stays pristine", async () => {
    const { form } = renderCheckout();
    act(() => form().reset({ ...SAVED, province: "istanbul", district: "fatih", neighbourhood: "aksaray mah." }));
    await expectSavedOnScreen();
    await waitFor(() => expect(formState().isDirty).toBe(false));
  });
});

describe("reset()", () => {
  it("reset(EMPTY) clears all three without calling address.reset()", async () => {
    const { form } = renderCheckout();
    await fillAll();
    act(() => form().reset(EMPTY));
    await expectEmptyOnScreen();
    expect(form().getValues()).toEqual(EMPTY);
    await waitFor(() => expect(formState().isDirty).toBe(false));
  });

  it("reset() with no arguments goes back to the default values", async () => {
    const { form } = renderCheckout({ defaultValues: SAVED });
    await expectSavedOnScreen();
    await userEvent.selectOptions(field("Province"), "1");
    await userEvent.clear(field("Phone"));
    await waitFor(() => expect(form().getValues("district")).toBe(""));
    await waitFor(() => expect(formState().isDirty).toBe(true));

    act(() => form().reset());
    await expectSavedOnScreen();
    expect(form().getValues()).toEqual(SAVED);
    await waitFor(() => expect(formState().isDirty).toBe(false));
  });

  it("reset() from one saved address to another", async () => {
    const { form } = renderCheckout({ defaultValues: SAVED });
    await expectSavedOnScreen();
    act(() =>
      form().reset({ ...SAVED, province: "ADANA", district: "SEYHAN", neighbourhood: "AKKAPI MAH.", postalCode: "01040" }),
    );
    await waitFor(() => expect(field("Neighbourhood").value).toBe("AKKAPI MAH."));
    expect(field("Province").value).toBe("1");
    expect(form().getValues("postalCode")).toBe("01040");
    await waitFor(() => expect(formState().isDirty).toBe(false));
  });

  it("address.reset() still clears the address in the form, as a user edit", async () => {
    let address!: ReturnType<typeof useViraAddress>;
    let form!: UseFormReturn<Checkout>;
    function Edit() {
      form = useForm<Checkout>({ defaultValues: SAVED });
      address = useViraAddress({ source, form });
      return (
        <>
          <select aria-label="Province" {...address.getProvinceProps()} />
          <FormStateProbe control={form.control} />
        </>
      );
    }
    render(<Edit />);
    act(() => address.reset());
    await waitFor(() =>
      expect(form.getValues()).toMatchObject({ province: "", district: "", neighbourhood: "", postalCode: "" }),
    );
    await waitFor(() => expect(formState().isDirty).toBe(true));
  });
});

describe("setValue()", () => {
  it("each package follows setValue() on its own fields", async () => {
    const { form } = renderCheckout();
    act(() => {
      form().setValue("phone", "5321112233");
      form().setValue("password", STRONG);
      form().setValue("province", "İSTANBUL");
      form().setValue("district", "KADIKÖY");
      form().setValue("neighbourhood", "CAFERAĞA MAH.");
    });
    expect(field("Phone").value).toBe("(532) 111 22 33");
    expect(field("Password").value).toBe(STRONG);
    await waitFor(() => expect(field("Neighbourhood").value).toBe("CAFERAĞA MAH."));
    expect(form().getValues("postalCode")).toBe("34710");
  });

  it("a new province set from code drops the district and neighbourhood it does not have", async () => {
    const { form } = renderCheckout({ defaultValues: SAVED });
    await expectSavedOnScreen();
    act(() => form().setValue("province", "ADANA"));
    await waitFor(() => expect(field("Province").value).toBe("1"));
    await waitFor(() =>
      expect(form().getValues()).toMatchObject({ province: "ADANA", district: "", neighbourhood: "", postalCode: "" }),
    );
    expect(field("District").value).toBe("");
  });

  it("watch() sees the raw mask value and the derived postal code", async () => {
    const seen: Partial<Checkout>[] = [];
    function Watching() {
      const form = useForm<Checkout>({ defaultValues: EMPTY });
      seen.push(form.watch());
      return <Fields form={form} />;
    }
    render(<Watching />);
    await fillAll();
    await waitFor(() => expect(seen.at(-1)).toEqual(SAVED));
  });
});

describe("resolvers", () => {
  const schema = z.object({
    tckn: z.string().min(1, "tckn.required"),
    phone: z.string().min(10, "phone.required"),
    password: z.string().min(8, "password.tooShort"),
    confirm: z.string(),
    province: z.string().min(1, "province.required"),
    district: z.string().min(1, "district.required"),
    neighbourhood: z.string().min(1, "neighbourhood.required"),
    postalCode: z.string(),
  });

  it("maskResolver + zodResolver report every empty field, then pass once filled", async () => {
    const onSubmit = vi.fn();
    renderCheckout({ resolver: maskResolver(MASKS, zodResolver(schema)), mode: "onChange" }, onSubmit);
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() =>
      expect(text("errors")).toContain("district,neighbourhood,password,phone,province,tckn"),
    );
    await fillAll();
    await waitFor(() => expect(text("errors")).toBe(""));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(SAVED));
  });

  it("the mask's own check still runs under a resolver", async () => {
    renderCheckout({ resolver: maskResolver(MASKS, zodResolver(schema)) });
    await userEvent.type(field("TCKN"), "12345678901");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(text("tckn-error")).toContain("tckn.invalid"));
  });

  it("a required district error clears when the province changes it", async () => {
    renderCheckout({ resolver: zodResolver(schema), mode: "onChange" });
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(text("errors")).toContain("province"));
    await userEvent.selectOptions(field("Province"), "34");
    await waitFor(() => expect(text("errors")).not.toContain("province"));
    // The district is still empty and still required.
    expect(text("errors")).toContain("district");
  });
});

describe("FormProvider", () => {
  function PhoneField() {
    const form = useFormContext<Checkout>();
    const { phone } = useViraMask(form, { phone: MASKS.phone });
    return <input aria-label="Phone" {...phone} />;
  }
  function PasswordField() {
    const form = useFormContext<Checkout>();
    const pw = useViraPassword({ value: form.watch("password") });
    return <input aria-label="Password" {...mergeProps(pw.inputProps, form.register("password", pw.rule))} />;
  }
  function AddressFields() {
    const address = useViraAddress({ source, form: useFormContext<Checkout>() });
    return (
      <>
        <select aria-label="Province" {...address.getProvinceProps()} />
        <select aria-label="District" {...address.getDistrictProps()} />
        <select aria-label="Neighbourhood" {...address.getNeighbourhoodProps()} />
      </>
    );
  }

  it("each package in its own component, through useFormContext()", async () => {
    let form!: UseFormReturn<Checkout>;
    function Page() {
      form = useForm<Checkout>({ defaultValues: EMPTY });
      return (
        <FormProvider {...form}>
          <PhoneField />
          <PasswordField />
          <AddressFields />
          <FormStateProbe control={form.control} />
        </FormProvider>
      );
    }
    render(<Page />);
    act(() => form.reset(SAVED));
    expect(field("Phone").value).toBe("(555) 123 45 67");
    expect(field("Password").value).toBe(STRONG);
    await waitFor(() => expect(field("Neighbourhood").value).toBe("AKSARAY MAH."));
    await waitFor(() => expect(formState().isDirty).toBe(false));

    act(() => form.reset(EMPTY));
    await waitFor(() => expect(field("Province").value).toBe(""));
    expect(field("Phone").value).toBe("");
  });
});

describe("field arrays", () => {
  interface Book {
    phone: string;
    addresses: { province: string; district: string; neighbourhood: string; postalCode: string }[];
  }
  const ADANA = { province: "ADANA", district: "SEYHAN", neighbourhood: "AKKAPI MAH.", postalCode: "01040" };
  const FATIH = { province: "İSTANBUL", district: "FATİH", neighbourhood: "AKSARAY MAH.", postalCode: "34096" };

  function AddressRow({ index }: { index: number }) {
    const address = useViraAddress({
      source,
      form: useFormContext<Book>(),
      names: {
        province: `addresses.${index}.province`,
        district: `addresses.${index}.district`,
        neighbourhood: `addresses.${index}.neighbourhood`,
        postalCode: `addresses.${index}.postalCode`,
      },
    });
    return (
      <>
        <select aria-label={`Province ${index}`} {...address.getProvinceProps()} />
        <select aria-label={`District ${index}`} {...address.getDistrictProps()} />
        <select aria-label={`Neighbourhood ${index}`} {...address.getNeighbourhoodProps()} />
      </>
    );
  }

  let form!: UseFormReturn<Book>;
  let array!: ReturnType<typeof useFieldArray<Book, "addresses">>;
  function AddressBook({ defaults }: { defaults: Book }) {
    form = useForm<Book>({ defaultValues: defaults });
    array = useFieldArray({ control: form.control, name: "addresses" });
    const { phone } = useViraMask(form, { phone: MASKS.phone });
    return (
      <FormProvider {...form}>
        <input aria-label="Phone" {...phone} />
        {array.fields.map((item, index) => (
          <AddressRow key={item.id} index={index} />
        ))}
        <FormStateProbe control={form.control} />
      </FormProvider>
    );
  }

  it("each row writes its own address", async () => {
    render(<AddressBook defaults={{ phone: "", addresses: [{ ...FATIH, province: "", district: "", neighbourhood: "", postalCode: "" }] }} />);
    act(() => array.append({ province: "", district: "", neighbourhood: "", postalCode: "" }));
    await userEvent.selectOptions(field("Province 0"), "34");
    await userEvent.selectOptions(field("Province 1"), "1");
    await waitFor(() => expect(field("District 1").disabled).toBe(false));
    await userEvent.selectOptions(field("District 1"), "SEYHAN");
    await waitFor(() => expect(field("Neighbourhood 1").disabled).toBe(false));
    await userEvent.selectOptions(field("Neighbourhood 1"), "AKKAPI MAH.");
    await waitFor(() => expect(form.getValues("addresses.1")).toEqual(ADANA));
    expect(form.getValues("addresses.0")).toEqual({ province: "İSTANBUL", district: "", neighbourhood: "", postalCode: "" });
  });

  it("removing the first row leaves the second one intact", async () => {
    render(<AddressBook defaults={{ phone: "5551234567", addresses: [FATIH, ADANA] }} />);
    await waitFor(() => expect(field("Neighbourhood 1").value).toBe("AKKAPI MAH."));
    act(() => array.remove(0));
    await waitFor(() => expect(field("Province 0").value).toBe("1"));
    expect(field("Neighbourhood 0").value).toBe("AKKAPI MAH.");
    expect(form.getValues("addresses")).toEqual([ADANA]);
    expect(field("Phone").value).toBe("(555) 123 45 67");
  });

  it("reset() of the whole book refills every row", async () => {
    render(<AddressBook defaults={{ phone: "", addresses: [FATIH, ADANA] }} />);
    await waitFor(() => expect(field("Neighbourhood 1").value).toBe("AKKAPI MAH."));
    act(() => form.reset({ phone: "5551234567", addresses: [ADANA, FATIH] }));
    await waitFor(() => expect(field("Neighbourhood 0").value).toBe("AKKAPI MAH."));
    await waitFor(() => expect(field("Neighbourhood 1").value).toBe("AKSARAY MAH."));
    expect(form.getValues("addresses")).toEqual([ADANA, FATIH]);
    await waitFor(() => expect(formState().isDirty).toBe(false));
  });
});

describe("mounting", () => {
  it("unmounting the fields keeps their values, and remounting shows them again", async () => {
    let form!: UseFormReturn<Checkout>;
    let setVisible!: (next: boolean) => void;
    function Toggle() {
      form = useForm<Checkout>({ defaultValues: EMPTY });
      const [visible, set] = useState(true);
      setVisible = set;
      return visible ? <Fields form={form} /> : null;
    }
    render(<Toggle />);
    await fillAll();
    act(() => setVisible(false));
    expect(form.getValues()).toEqual(SAVED);
    act(() => setVisible(true));
    await expectSavedOnScreen();
    expect(form.getValues()).toEqual(SAVED);
  });

  it("works the same under StrictMode", async () => {
    const ref = { current: null as UseFormReturn<Checkout> | null };
    function Checkout() {
      ref.current = useForm<Checkout>({ defaultValues: EMPTY });
      return <Fields form={ref.current} />;
    }
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
    render(<Checkout />, { wrapper });
    await fillAll();
    await waitFor(() => expect(ref.current!.getValues()).toEqual(SAVED));
    act(() => ref.current!.reset(EMPTY));
    await expectEmptyOnScreen();
    act(() => ref.current!.reset(SAVED));
    await expectSavedOnScreen();
    await waitFor(() => expect(formState().isDirty).toBe(false));
  });
});
