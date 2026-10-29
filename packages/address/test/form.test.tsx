import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { FormProvider, useForm, useFormContext, type UseFormReturn } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { useViraAddress } from "../src/index.js";
import { makeSource } from "./fixture.js";

interface Flat {
  province: string;
  district: string;
  neighbourhood: string;
  postalCode: string;
}

interface Nested {
  address: { il: string; ilce: string; mahalle: string; postaKodu: string; plaka: string };
}

const source = makeSource();
const EMPTY: Flat = { province: "", district: "", neighbourhood: "", postalCode: "" };

/** Renders the hook inside a FormProvider and tracks the form's state. */
function renderInProvider(defaultValues: Partial<Flat> = {}) {
  const form = { current: null as UseFormReturn<Flat> | null };
  const state = { current: { isDirty: false, touched: {} as object } };
  function Wrapper({ children }: { children: ReactNode }) {
    const methods = useForm<Flat>({ defaultValues: { ...EMPTY, ...defaultValues } });
    form.current = methods;
    // Read during render so React Hook Form tracks these.
    state.current = { isDirty: methods.formState.isDirty, touched: methods.formState.touchedFields };
    return <FormProvider {...methods}>{children}</FormProvider>;
  }
  const hook = renderHook(() => useViraAddress({ source, form: useFormContext<Flat>() }), { wrapper: Wrapper });
  return { ...hook, values: () => form.current!.getValues(), state };
}

describe("useViraAddress with a form", () => {
  it("writes every pick into the default fields", async () => {
    const { result, values, state } = renderInProvider();

    act(() => result.current.setProvince(34));
    await waitFor(() => expect(result.current.loading.neighbourhoods).toBe(false));
    act(() => result.current.setDistrict("FATİH"));
    act(() => result.current.setNeighbourhood("AKSARAY MAH."));

    await waitFor(() =>
      expect(values()).toEqual({ province: "İSTANBUL", district: "FATİH", neighbourhood: "AKSARAY MAH.", postalCode: "34096" }),
    );
    expect(state.current.isDirty).toBe(true);
  });

  it("clears the levels below a new province in the form too", async () => {
    const { result, values } = renderInProvider();

    act(() => result.current.setProvince(34));
    await waitFor(() => expect(result.current.loading.neighbourhoods).toBe(false));
    act(() => result.current.setDistrict("FATİH"));
    act(() => result.current.setNeighbourhood("AKSARAY MAH."));
    act(() => result.current.setProvince(1));

    await waitFor(() => expect(values()).toEqual({ ...EMPTY, province: "ADANA" }));
  });

  it("starts from the address the form already holds, and leaves it pristine", async () => {
    const { result, state } = renderInProvider({
      province: "İstanbul",
      district: "Fatih",
      neighbourhood: "AKSARAY MAH.",
      postalCode: "34096",
    });

    expect(result.current.value).toMatchObject({ provinceCode: "34", district: "FATİH", neighbourhood: "AKSARAY MAH." });
    await waitFor(() => expect(result.current.value.postalCode).toBe("34096"));
    expect(state.current.isDirty).toBe(false);
    expect(state.current.touched).toEqual({});
  });

  it("matches a neighbourhood however the form spelled it", async () => {
    const { result, values, state } = renderInProvider({
      province: "istanbul",
      district: "fatih",
      neighbourhood: "Aksaray Mah.",
    });

    await waitFor(() => expect(result.current.value.postalCode).toBe("34096"));
    expect(result.current.value.neighbourhood).toBe("AKSARAY MAH.");
    expect(result.current.getNeighbourhoodProps().value).toBe("AKSARAY MAH.");
    // The derived postal code lands in the form without making it an edit.
    expect(values().postalCode).toBe("34096");
    expect(state.current.isDirty).toBe(false);
  });

  it("writes to the fields it is told to, and the plate code only when named", async () => {
    const names = {
      province: "address.il",
      district: "address.ilce",
      neighbourhood: "address.mahalle",
      postalCode: "address.postaKodu",
      provinceCode: "address.plaka",
    } as const;
    const { result } = renderHook(() => {
      const form = useForm<Nested>();
      return { form, address: useViraAddress({ source, form, names }) };
    });

    act(() => result.current.address.setProvince(1));
    await waitFor(() => expect(result.current.form.getValues("address.il")).toBe("ADANA"));
    expect(result.current.form.getValues("address.plaka")).toBe("1");
    // The same names go on the inputs, so a native submit matches the form.
    expect(result.current.address.getProvinceProps().name).toBe("address.il");
    expect(result.current.address.getPostalCodeProps().name).toBe("address.postaKodu");
  });

  it("takes any object with setValue, not only React Hook Form", async () => {
    const setValue = vi.fn();
    const { result } = renderHook(() => useViraAddress({ source, form: { setValue } }));

    act(() => result.current.setProvince(1));
    await waitFor(() =>
      expect(setValue).toHaveBeenCalledWith("province", "ADANA", { shouldDirty: true, shouldTouch: true, shouldValidate: true }),
    );
    expect(setValue).not.toHaveBeenCalledWith("provinceCode", expect.anything(), expect.anything());
  });

  it("checks field names against the form's type", () => {
    renderHook(() => {
      const form = useForm<Flat>();
      // @ts-expect-error "il" is not a field of Flat
      return useViraAddress({ source, form, names: { province: "il" } });
    });
  });
});
