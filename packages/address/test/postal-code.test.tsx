import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm, type UseFormReturn } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";

import { formatAddress, useViraAddress, type AddressSource, type UseViraAddressOptions } from "../src/index.js";
import type { AddressNeighbourhood } from "../src/core/types.js";
import { makeDeferredSource, makeSource } from "./fixture.js";

const source = makeSource();

afterEach(cleanup);

const one = (name: string, postalCode: string): AddressNeighbourhood => ({ name, postalCode, postalCodes: [postalCode] });
const asMap = (entries: Record<string, AddressNeighbourhood[]>) => new Map(Object.entries(entries));

describe("setPostalCode", () => {
  it("fills every level from a code with one neighbourhood", async () => {
    const { result } = renderHook(() => useViraAddress({ source }));

    let status: unknown;
    await act(async () => {
      status = await result.current.setPostalCode("34710");
    });

    expect(status).toBe("exact");
    expect(result.current.postalCodeStatus).toBe("exact");
    expect(result.current.value).toEqual({
      provinceCode: "34",
      province: "İSTANBUL",
      district: "KADIKÖY",
      neighbourhood: "CAFERAĞA MAH.",
      postalCode: "34710",
      postalCodes: ["34710"],
    });
    expect(result.current.loading.neighbourhoods).toBe(false);
  });

  it("fills province and district from a shared code and narrows the neighbourhoods", async () => {
    const { result } = renderHook(() => useViraAddress({ source }));

    await act(async () => {
      expect(await result.current.setPostalCode("01040")).toBe("partial");
    });

    expect(result.current.value).toMatchObject({
      province: "ADANA",
      district: "SEYHAN",
      neighbourhood: null,
      postalCode: "01040",
      postalCodes: ["01040"],
    });
    // ALTINŞEHİR is in SEYHAN too, but under another code.
    expect(result.current.neighbourhoods.map((n) => n.value)).toEqual(["AKKAPI MAH.", "DAĞLIOĞLU MAH."]);
    expect(result.current.districts.map((d) => d.value)).toEqual(["CEYHAN", "SEYHAN"]);
  });

  it("keeps the code and the narrowed list once the user picks a neighbourhood", async () => {
    const { result } = renderHook(() => useViraAddress({ source }));
    await act(async () => {
      await result.current.setPostalCode("01040");
    });

    act(() => result.current.setNeighbourhood("DAĞLIOĞLU MAH."));
    expect(result.current.value).toMatchObject({ neighbourhood: "DAĞLIOĞLU MAH.", postalCode: "01040" });
    expect(result.current.postalCodeStatus).toBe("partial");
    expect(result.current.neighbourhoods).toHaveLength(2);
  });

  it("reports the typed code for a neighbourhood that has several", async () => {
    const { result } = renderHook(() => useViraAddress({ source }));
    await act(async () => {
      expect(await result.current.setPostalCode("02010")).toBe("exact");
    });

    // The neighbourhood's first code is 02290; the user asked for 02010.
    expect(result.current.value).toMatchObject({
      neighbourhood: "CUMHURİYET MAH.",
      postalCode: "02010",
      postalCodes: ["02290", "02010", "02040"],
    });
  });

  it("keeps a neighbourhood already picked under the code", async () => {
    const { result } = renderHook(() => useViraAddress({ source }));
    act(() => result.current.setProvince(1));
    await waitFor(() => expect(result.current.loading.neighbourhoods).toBe(false));
    act(() => result.current.setDistrict("SEYHAN"));
    act(() => result.current.setNeighbourhood("DAĞLIOĞLU MAH."));

    await act(async () => {
      expect(await result.current.setPostalCode("01040")).toBe("partial");
    });
    expect(result.current.value.neighbourhood).toBe("DAĞLIOĞLU MAH.");
  });

  it("drops a neighbourhood the code does not cover", async () => {
    const { result } = renderHook(() => useViraAddress({ source }));
    act(() => result.current.setProvince(1));
    await waitFor(() => expect(result.current.loading.neighbourhoods).toBe(false));
    act(() => result.current.setDistrict("SEYHAN"));
    act(() => result.current.setNeighbourhood("ALTINŞEHİR MAH."));

    await act(async () => {
      await result.current.setPostalCode("01040");
    });
    expect(result.current.value).toMatchObject({ district: "SEYHAN", neighbourhood: null, postalCode: "01040" });
  });

  it("moves to another province", async () => {
    const { result } = renderHook(() => useViraAddress({ source }));
    act(() => result.current.setProvince(1));
    await waitFor(() => expect(result.current.loading.neighbourhoods).toBe(false));

    await act(async () => {
      await result.current.setPostalCode("34710");
    });
    expect(result.current.value).toMatchObject({ province: "İSTANBUL", district: "KADIKÖY", neighbourhood: "CAFERAĞA MAH." });
  });

  it("changes nothing for a code that is not in the dataset", async () => {
    const { result } = renderHook(() => useViraAddress({ source }));
    await act(async () => {
      await result.current.setPostalCode("34710");
    });
    const before = result.current.value;

    for (const code of ["34999", "99000", "abc", "3471", "340960"]) {
      await act(async () => {
        expect(await result.current.setPostalCode(code)).toBe("unknown");
      });
      expect(result.current.postalCodeStatus).toBe("unknown");
      expect(result.current.value).toMatchObject({
        province: before.province,
        district: before.district,
        neighbourhood: before.neighbourhood,
      });
    }
  });

  it("takes spaces and numbers", async () => {
    const { result } = renderHook(() => useViraAddress({ source }));
    await act(async () => {
      expect(await result.current.setPostalCode(" 34 710 ")).toBe("exact");
    });
    await act(async () => {
      expect(await result.current.setPostalCode(34096)).toBe("exact");
    });
    expect(result.current.value.neighbourhood).toBe("AKSARAY MAH.");
  });

  it("clears the lookup with null and keeps the address", async () => {
    const { result } = renderHook(() => useViraAddress({ source }));
    await act(async () => {
      await result.current.setPostalCode("01040");
    });

    await act(async () => {
      expect(await result.current.setPostalCode(null)).toBeNull();
    });
    expect(result.current.postalCodeStatus).toBeNull();
    expect(result.current.value).toMatchObject({ province: "ADANA", district: "SEYHAN", postalCode: null });
    // No longer narrowed.
    expect(result.current.neighbourhoods).toHaveLength(3);

    await act(async () => {
      expect(await result.current.setPostalCode("")).toBeNull();
    });
  });

  it.each([
    ["setProvince", (r: ReturnType<typeof useViraAddress>) => r.setProvince(34)],
    ["setDistrict", (r: ReturnType<typeof useViraAddress>) => r.setDistrict("CEYHAN")],
    ["reset", (r: ReturnType<typeof useViraAddress>) => r.reset()],
  ])("forgets the code after %s by hand", async (_name, pick) => {
    const { result } = renderHook(() => useViraAddress({ source }));
    await act(async () => {
      await result.current.setPostalCode("01040");
    });

    act(() => pick(result.current));
    expect(result.current.postalCodeStatus).toBeNull();
    expect(result.current.value.postalCode).toBeNull();
  });

  it("lists every neighbourhood again once the district is picked anew", async () => {
    const { result } = renderHook(() => useViraAddress({ source }));
    await act(async () => {
      await result.current.setPostalCode("01040");
    });
    act(() => result.current.setDistrict("SEYHAN"));
    expect(result.current.neighbourhoods).toHaveLength(3);
  });

  it("says it is loading until the province arrives", async () => {
    const { source, pending } = makeDeferredSource();
    const { result } = renderHook(() => useViraAddress({ source }));

    let done: Promise<unknown> = Promise.resolve();
    act(() => {
      done = result.current.setPostalCode("34710");
    });
    expect(result.current.postalCodeStatus).toBe("loading");
    expect(result.current.value.province).toBeNull();

    await act(async () => {
      pending[0]?.resolve(asMap({ KADIKÖY: [one("CAFERAĞA MAH.", "34710")] }));
      await done;
    });
    expect(result.current.postalCodeStatus).toBe("exact");
  });

  it("loads the province once, not again for the selects", async () => {
    const neighbourhoods = vi.fn(source.neighbourhoods);
    const counted: AddressSource = { ...source, neighbourhoods };
    const { result } = renderHook(() => useViraAddress({ source: counted }));

    await act(async () => {
      await result.current.setPostalCode("34710");
    });
    expect(result.current.loading.neighbourhoods).toBe(false);
    expect(neighbourhoods).toHaveBeenCalledTimes(1);
  });

  it("lets a pick by hand win over a lookup still loading", async () => {
    const { source, pending } = makeDeferredSource();
    const { result } = renderHook(() => useViraAddress({ source }));

    let done: Promise<unknown> = Promise.resolve();
    act(() => {
      done = result.current.setPostalCode("34710");
    });
    act(() => result.current.setProvince(1));

    await act(async () => {
      pending[0]?.resolve(asMap({ KADIKÖY: [one("CAFERAĞA MAH.", "34710")] }));
      await done;
    });
    expect(result.current.value.province).toBe("ADANA");
    expect(result.current.postalCodeStatus).toBeNull();
  });

  it("lets the latest code win when two are still loading", async () => {
    const { source, pending } = makeDeferredSource();
    const { result } = renderHook(() => useViraAddress({ source }));

    let first: Promise<unknown> = Promise.resolve();
    let second: Promise<unknown> = Promise.resolve();
    act(() => {
      first = result.current.setPostalCode("34710");
    });
    act(() => {
      second = result.current.setPostalCode("01950");
    });

    await act(async () => {
      pending[1]?.resolve(asMap({ CEYHAN: [one("BAHÇE MAH.", "01950")] }));
      await second;
      pending[0]?.resolve(asMap({ KADIKÖY: [one("CAFERAĞA MAH.", "34710")] }));
      await first;
    });
    expect(result.current.value).toMatchObject({ province: "ADANA", district: "CEYHAN", neighbourhood: "BAHÇE MAH." });
  });

  it("reports a failed load and keeps the address", async () => {
    const failing = makeSource({
      neighbourhoods: async () => {
        throw new Error("offline");
      },
    });
    const { result } = renderHook(() => useViraAddress({ source: failing }));

    await act(async () => {
      expect(await result.current.setPostalCode("34710")).toBeNull();
    });
    expect(result.current.error?.message).toBe("offline");
    expect(result.current.postalCodeStatus).toBeNull();
    expect(result.current.value.province).toBeNull();
  });

  it("fills only the province when a custom source puts a code in two districts", async () => {
    const spread = makeSource({
      neighbourhoods: async () =>
        asMap({ KADIKÖY: [one("CAFERAĞA MAH.", "34000")], FATİH: [one("AKSARAY MAH.", "34000"), one("BAŞKA MAH.", "34001")] }),
    });
    const { result } = renderHook(() => useViraAddress({ source: spread }));

    await act(async () => {
      expect(await result.current.setPostalCode("34000")).toBe("partial");
    });
    expect(result.current.value).toMatchObject({ province: "İSTANBUL", district: null, postalCode: "34000" });
  });

  it("reports the filled address once through onChange", async () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useViraAddress({ source, onChange }));

    await act(async () => {
      await result.current.setPostalCode("34710");
    });
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ neighbourhood: "CAFERAĞA MAH.", postalCode: "34710" });
  });

  it("gives formatAddress everything it needs", async () => {
    const { result } = renderHook(() => useViraAddress({ source }));
    await act(async () => {
      await result.current.setPostalCode("01040");
    });
    expect(formatAddress(result.current.value)).toBe("Seyhan/Adana");
    expect(formatAddress(result.current.value, { postalCode: true })).toBe("01040 Seyhan/Adana");

    act(() => result.current.setNeighbourhood("AKKAPI MAH."));
    expect(formatAddress(result.current.value, { postalCode: true })).toBe("Akkapı Mah. 01040 Seyhan/Adana");
  });
});

function Fields(props: UseViraAddressOptions) {
  const address = useViraAddress({ source, ...props });
  return (
    <>
      <label>
        Province
        <select {...address.getProvinceProps()} />
      </label>
      <label>
        District
        <select {...address.getDistrictProps()} />
      </label>
      <label>
        Neighbourhood
        <select {...address.getNeighbourhoodProps()} />
      </label>
      <label>
        Postal code
        <input {...address.getPostalCodeInputProps()} />
      </label>
      <output>{address.postalCodeStatus ?? "none"}</output>
    </>
  );
}

const field = (label: string) => screen.getByLabelText<HTMLInputElement & HTMLSelectElement>(label);

describe("getPostalCodeInputProps", () => {
  it("fills the selects once five digits are typed", async () => {
    render(<Fields />);

    await userEvent.type(field("Postal code"), "34710");
    await waitFor(() => expect(field("Neighbourhood").value).toBe("CAFERAĞA MAH."));
    expect(field("Province").value).toBe("34");
    expect(field("District").value).toBe("KADIKÖY");
    expect(field("Postal code").value).toBe("34710");
    expect(screen.getByRole("status").textContent).toBe("exact");
  });

  it("waits for five digits and drops anything else typed", async () => {
    render(<Fields />);

    await userEvent.type(field("Postal code"), "34-7 1");
    expect(field("Postal code").value).toBe("3471");
    expect(field("Province").value).toBe("");
    expect(screen.getByRole("status").textContent).toBe("none");

    await userEvent.type(field("Postal code"), "0");
    await waitFor(() => expect(field("Province").value).toBe("34"));
  });

  it("is a numeric postal code field", () => {
    render(<Fields names={{ postalCode: "postaKodu" }} />);
    const input = field("Postal code");

    expect(input.getAttribute("inputmode")).toBe("numeric");
    expect(input.getAttribute("autocomplete")).toBe("postal-code");
    expect(input.getAttribute("maxlength")).toBe("5");
    expect(input.getAttribute("name")).toBe("postaKodu");
    expect(input.getAttribute("placeholder")).toBe("Posta kodu");
  });

  it("marks an unknown code invalid and keeps what was typed", async () => {
    render(<Fields />);

    await userEvent.type(field("Postal code"), "34999");
    await waitFor(() => expect(field("Postal code").getAttribute("aria-invalid")).toBe("true"));
    expect(field("Postal code").value).toBe("34999");
    expect(field("Province").value).toBe("");

    await userEvent.type(field("Postal code"), "{backspace}");
    expect(field("Postal code").getAttribute("aria-invalid")).toBe("false");
  });

  it("leaves the neighbourhood to the user for a shared code", async () => {
    render(<Fields />);

    await userEvent.type(field("Postal code"), "01040");
    await waitFor(() => expect(field("District").value).toBe("SEYHAN"));
    expect(field("Neighbourhood").value).toBe("");
    expect(field("Neighbourhood").disabled).toBe(false);
    // The placeholder plus the two neighbourhoods under 01040.
    expect(field("Neighbourhood").options).toHaveLength(3);

    await userEvent.selectOptions(field("Neighbourhood"), "AKKAPI MAH.");
    expect(field("Postal code").value).toBe("01040");
  });

  it("shows the derived code after a pick in the selects", async () => {
    render(<Fields />);

    await userEvent.selectOptions(field("Province"), "34");
    await waitFor(() => expect(field("District").disabled).toBe(false));
    await userEvent.selectOptions(field("District"), "FATİH");
    await waitFor(() => expect(field("Neighbourhood").disabled).toBe(false));
    await userEvent.selectOptions(field("Neighbourhood"), "AKSARAY MAH.");

    expect(field("Postal code").value).toBe("34096");
  });

  it("follows the selects again after a pick by hand", async () => {
    render(<Fields />);

    await userEvent.type(field("Postal code"), "34710");
    await waitFor(() => expect(field("District").value).toBe("KADIKÖY"));

    await userEvent.selectOptions(field("District"), "FATİH");
    expect(field("Postal code").value).toBe("");
    expect(screen.getByRole("status").textContent).toBe("none");
  });

  it("keeps the address while the code is being retyped", async () => {
    render(<Fields />);

    await userEvent.type(field("Postal code"), "34710");
    await waitFor(() => expect(field("District").value).toBe("KADIKÖY"));
    await userEvent.type(field("Postal code"), "{backspace}{backspace}");

    expect(field("Postal code").value).toBe("347");
    expect(field("Neighbourhood").value).toBe("CAFERAĞA MAH.");
  });
});

interface Checkout {
  province: string;
  district: string;
  neighbourhood: string;
  postalCode: string;
}

const EMPTY: Checkout = { province: "", district: "", neighbourhood: "", postalCode: "" };

describe("postal code lookup with React Hook Form", () => {
  function renderWithForm(defaultValues: Partial<Checkout> = {}) {
    const ref = { current: null as UseFormReturn<Checkout> | null };
    const state = { current: { isDirty: false } };
    function Form() {
      const form = useForm<Checkout>({ defaultValues: { ...EMPTY, ...defaultValues } });
      ref.current = form;
      state.current = { isDirty: form.formState.isDirty };
      return <Fields form={form as never} />;
    }
    render(<Form />);
    return { form: () => ref.current!, state };
  }

  it("writes every level into the form, dirty", async () => {
    const { form, state } = renderWithForm();

    await userEvent.type(field("Postal code"), "34710");
    await waitFor(() =>
      expect(form().getValues()).toEqual({
        province: "İSTANBUL",
        district: "KADIKÖY",
        neighbourhood: "CAFERAĞA MAH.",
        postalCode: "34710",
      }),
    );
    expect(state.current.isDirty).toBe(true);
  });

  it("writes the code with an empty neighbourhood for a shared one", async () => {
    const { form } = renderWithForm();

    await userEvent.type(field("Postal code"), "01040");
    await waitFor(() =>
      expect(form().getValues()).toEqual({ province: "ADANA", district: "SEYHAN", neighbourhood: "", postalCode: "01040" }),
    );

    await userEvent.selectOptions(field("Neighbourhood"), "DAĞLIOĞLU MAH.");
    await waitFor(() => expect(form().getValues("neighbourhood")).toBe("DAĞLIOĞLU MAH."));
    expect(form().getValues("postalCode")).toBe("01040");
  });

  it("replaces an edit form's address", async () => {
    const { form } = renderWithForm({ province: "İSTANBUL", district: "FATİH", neighbourhood: "AKSARAY MAH.", postalCode: "34096" });
    await waitFor(() => expect(field("Neighbourhood").value).toBe("AKSARAY MAH."));

    await userEvent.clear(field("Postal code"));
    await userEvent.type(field("Postal code"), "01950");
    await waitFor(() =>
      expect(form().getValues()).toEqual({ province: "ADANA", district: "CEYHAN", neighbourhood: "BAHÇE MAH.", postalCode: "01950" }),
    );
  });

  it("forgets the code when the form is reset", async () => {
    const { form } = renderWithForm();

    await userEvent.type(field("Postal code"), "01040");
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("partial"));

    act(() => form().reset({ province: "İSTANBUL", district: "FATİH", neighbourhood: "AKSARAY MAH.", postalCode: "34096" }));
    await waitFor(() => expect(field("Neighbourhood").value).toBe("AKSARAY MAH."));
    expect(screen.getByRole("status").textContent).toBe("none");
    expect(field("Postal code").value).toBe("34096");
  });
});
