import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { FormProvider, useForm, type UseFormReturn } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { useViraAddressField } from "../src/rhf.js";
import { makeSource } from "./fixture.js";

interface Form {
  province: string;
  district: string;
  neighbourhood: string;
  postalCode: string;
}

const source = makeSource();
const names = { province: "province", district: "district", neighbourhood: "neighbourhood", postalCode: "postalCode" } as const;
const EMPTY: Form = { province: "", district: "", neighbourhood: "", postalCode: "" };

function renderField(defaultValues: Partial<Form> = {}) {
  const form = { current: null as UseFormReturn<Form> | null };
  const state = { current: { isDirty: false, touched: {} as object } };
  function Wrapper({ children }: { children: ReactNode }) {
    const methods = useForm<Form>({ defaultValues: { ...EMPTY, ...defaultValues } });
    form.current = methods;
    // Read during render so React Hook Form tracks these.
    state.current = { isDirty: methods.formState.isDirty, touched: methods.formState.touchedFields };
    return <FormProvider {...methods}>{children}</FormProvider>;
  }
  const hook = renderHook(() => useViraAddressField<Form>({ source, names }), { wrapper: Wrapper });
  return { ...hook, values: () => form.current!.getValues(), state };
}

describe("useViraAddressField", () => {
  it("writes every pick into the form", async () => {
    const { result, values, state } = renderField();

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
    const { result, values } = renderField();

    act(() => result.current.setProvince(34));
    await waitFor(() => expect(result.current.loading.neighbourhoods).toBe(false));
    act(() => result.current.setDistrict("FATİH"));
    act(() => result.current.setNeighbourhood("AKSARAY MAH."));
    act(() => result.current.setProvince(1));

    await waitFor(() => expect(values()).toEqual({ ...EMPTY, province: "ADANA" }));
  });

  it("starts from the address the form already holds, and leaves it pristine", async () => {
    const { result, state } = renderField({
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

  it("works outside a FormProvider when given setValue", async () => {
    const { result } = renderHook(() => {
      const form = useForm<Form>({ defaultValues: EMPTY });
      const address = useViraAddressField<Form>({ source, names, setValue: form.setValue });
      return { form, address };
    });

    act(() => result.current.address.setProvince(1));
    await waitFor(() => expect(result.current.form.getValues("province")).toBe("ADANA"));
  });

  it("explains itself without a form", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useViraAddressField<Form>({ source, names }))).toThrow(/FormProvider/);
    quiet.mockRestore();
  });
});
