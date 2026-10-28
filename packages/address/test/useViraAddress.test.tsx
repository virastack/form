import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { useViraAddress } from "../src/index.js";
import { makeDeferredSource, makeSource } from "./fixture.js";

const source = makeSource();

describe("useViraAddress", () => {
  it("lists provinces sorted the Turkish way and nothing below them", () => {
    const { result } = renderHook(() => useViraAddress({ source }));

    expect(result.current.provinces.map((p) => p.label)).toEqual(["Adana", "Adıyaman", "İstanbul"]);
    expect(result.current.districts).toEqual([]);
    expect(result.current.neighbourhoods).toEqual([]);
    expect(result.current.value.postalCode).toBeNull();
  });

  it("fills districts from the picked province", async () => {
    const { result } = renderHook(() => useViraAddress({ source }));

    act(() => result.current.setProvince(34));
    expect(result.current.districts.map((d) => d.label)).toEqual(["Fatih", "Kadıköy"]);
    expect(result.current.value.province).toBe("İSTANBUL");
    expect(result.current.value.provinceCode).toBe("34");

    await waitFor(() => expect(result.current.loading.neighbourhoods).toBe(false));
  });

  it("derives the postal code once a neighbourhood is picked", async () => {
    const { result } = renderHook(() => useViraAddress({ source }));

    act(() => result.current.setProvince(34));
    await waitFor(() => expect(result.current.loading.neighbourhoods).toBe(false));
    act(() => result.current.setDistrict("FATİH"));
    expect(result.current.neighbourhoods.map((n) => n.label)).toEqual(["Aksaray Mah."]);

    act(() => result.current.setNeighbourhood("AKSARAY MAH."));
    expect(result.current.value).toMatchObject({
      province: "İSTANBUL",
      district: "FATİH",
      neighbourhood: "AKSARAY MAH.",
      postalCode: "34096",
    });
  });

  it("clears every level below the one that changed", async () => {
    const { result } = renderHook(() => useViraAddress({ source }));

    act(() => result.current.setProvince(34));
    await waitFor(() => expect(result.current.loading.neighbourhoods).toBe(false));
    act(() => result.current.setDistrict("FATİH"));
    act(() => result.current.setNeighbourhood("AKSARAY MAH."));
    expect(result.current.value.postalCode).toBe("34096");

    // Changing the province resets district, neighbourhood and postal code.
    act(() => result.current.setProvince(1));
    expect(result.current.value).toMatchObject({
      province: "ADANA",
      district: null,
      neighbourhood: null,
      postalCode: null,
    });

    await waitFor(() => expect(result.current.loading.neighbourhoods).toBe(false));
    act(() => result.current.setDistrict("SEYHAN"));
    act(() => result.current.setNeighbourhood("AKKAPI MAH."));
    expect(result.current.value.postalCode).toBe("01040");

    // Changing only the district keeps the province and drops the rest.
    act(() => result.current.setDistrict("CEYHAN"));
    expect(result.current.value).toMatchObject({ province: "ADANA", district: "CEYHAN", neighbourhood: null, postalCode: null });
  });

  it("reports every change except the first render", async () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useViraAddress({ source, onChange }));

    expect(onChange).not.toHaveBeenCalled();
    act(() => result.current.setProvince(1));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ province: "ADANA", district: null });
  });

  it("ignores a province's load that finished after a newer pick", async () => {
    const { source, pending } = makeDeferredSource();
    const { result } = renderHook(() => useViraAddress({ source }));

    act(() => result.current.setProvince(34));
    act(() => result.current.setProvince(1));
    expect(pending).toHaveLength(2);

    // The slow İstanbul response lands last and must not overwrite Adana.
    await act(async () => {
      pending[1].resolve(new Map([["SEYHAN", [{ name: "AKKAPI MAH.", postalCode: "01040", postalCodes: ["01040"] }]]]));
      pending[0].resolve(new Map([["FATİH", [{ name: "AKSARAY MAH.", postalCode: "34096", postalCodes: ["34096"] }]]]));
    });

    act(() => result.current.setDistrict("SEYHAN"));
    expect(result.current.neighbourhoods.map((n) => n.value)).toEqual(["AKKAPI MAH."]);
  });

  it("never shows the previous province's list for a district both have", async () => {
    const { source, pending } = makeDeferredSource();
    const twoMerkez = {
      ...source,
      provinces: [
        { code: 2, name: "ADIYAMAN", districts: ["MERKEZ"] },
        { code: 3, name: "AFYONKARAHİSAR", districts: ["MERKEZ"] },
      ],
    };
    const { result } = renderHook(() => useViraAddress({ source: twoMerkez }));

    act(() => result.current.setProvince(2));
    await act(async () => {
      pending[0].resolve(new Map([["MERKEZ", [{ name: "ALTINŞEHİR MAH.", postalCode: "02040", postalCodes: ["02040"] }]]]));
    });

    // Afyonkarahisar is still loading; Adıyaman's MERKEZ must not stand in for it.
    act(() => result.current.setProvince(3));
    act(() => result.current.setDistrict("MERKEZ"));
    expect(result.current.neighbourhoods).toEqual([]);
    expect(result.current.getNeighbourhoodProps()["aria-busy"]).toBe(true);
  });

  it("surfaces a failed load", async () => {
    const source = makeSource({ neighbourhoods: async () => { throw new Error("offline"); } });
    const { result } = renderHook(() => useViraAddress({ source }));

    act(() => result.current.setProvince(34));
    await waitFor(() => expect(result.current.error?.message).toBe("offline"));
    expect(result.current.loading.neighbourhoods).toBe(false);
  });

  it("resets everything", async () => {
    const { result } = renderHook(() => useViraAddress({ source }));
    act(() => result.current.setProvince(34));
    act(() => result.current.reset());
    expect(result.current.value.provinceCode).toBeNull();
    expect(result.current.districts).toEqual([]);
  });

  it("starts from a default value", () => {
    const { result } = renderHook(() =>
      useViraAddress({ source, defaultValue: { provinceCode: 1, district: "SEYHAN" } }),
    );
    expect(result.current.value.province).toBe("ADANA");
    expect(result.current.districts.map((d) => d.value)).toEqual(["CEYHAN", "SEYHAN"]);
  });

  it("exposes every postal code when a neighbourhood has several", async () => {
    const { result } = renderHook(() => useViraAddress({ source }));

    act(() => result.current.setProvince(2));
    await waitFor(() => expect(result.current.loading.neighbourhoods).toBe(false));
    act(() => result.current.setDistrict("MERKEZ"));
    act(() => result.current.setNeighbourhood("CUMHURİYET MAH."));

    expect(result.current.value.postalCode).toBe("02290");
    expect(result.current.value.postalCodes).toEqual(["02290", "02010", "02040"]);
  });

  it("takes a custom label formatter", () => {
    const { result } = renderHook(() => useViraAddress({ source, formatLabel: (name) => name }));
    expect(result.current.provinces.map((p) => p.label)).toEqual(["ADANA", "ADIYAMAN", "İSTANBUL"]);
  });
});

describe("prop getters", () => {
  it("disables a level until the one above it is picked", async () => {
    const { result } = renderHook(() => useViraAddress({ source }));

    expect(result.current.getProvinceProps().disabled).toBe(false);
    expect(result.current.getDistrictProps().disabled).toBe(true);
    expect(result.current.getNeighbourhoodProps().disabled).toBe(true);

    act(() => result.current.setProvince(34));
    expect(result.current.getDistrictProps().disabled).toBe(false);
    await waitFor(() => expect(result.current.loading.neighbourhoods).toBe(false));

    act(() => result.current.setDistrict("FATİH"));
    expect(result.current.getNeighbourhoodProps().disabled).toBe(false);
  });

  it("lets the caller override the defaults", () => {
    const { result } = renderHook(() => useViraAddress({ source }));
    expect(result.current.getDistrictProps({ disabled: false }).disabled).toBe(false);
    expect(result.current.getProvinceProps({ placeholder: "Nerede?" }).placeholder).toBe("Nerede?");
    expect(result.current.getProvinceProps({ name: "sehir" }).name).toBe("sehir");
  });

  it("marks a loading level busy", async () => {
    const { source, pending } = makeDeferredSource();
    const { result } = renderHook(() => useViraAddress({ source }));

    act(() => result.current.setProvince(34));
    act(() => result.current.setDistrict("FATİH"));
    expect(result.current.getNeighbourhoodProps()["aria-busy"]).toBe(true);
    expect(result.current.getNeighbourhoodProps().disabled).toBe(true);

    await act(async () => {
      pending[0].resolve(new Map([["FATİH", [{ name: "AKSARAY MAH.", postalCode: "34096", postalCodes: ["34096"] }]]]));
    });
    expect(result.current.getNeighbourhoodProps()["aria-busy"]).toBe(false);
  });

  it("renames props per library", () => {
    const { result } = renderHook(() => useViraAddress({ source }));

    const shadcn = result.current.getProvinceProps({ as: "shadcn" });
    expect(shadcn).toHaveProperty("onValueChange");
    expect(shadcn).not.toHaveProperty("onChange");

    const antd = result.current.getProvinceProps({ as: "antd" });
    expect(antd).toMatchObject({ showSearch: true, optionFilterProp: "label" });
    // antd only shows the placeholder for an undefined value.
    expect(antd.value).toBeUndefined();
  });

  it("filters antd options the Turkish way", () => {
    const { result } = renderHook(() => useViraAddress({ source }));
    const filter = result.current.getProvinceProps({ as: "antd" }).filterOption as (
      input: string,
      option?: { label?: unknown },
    ) => boolean;

    expect(filter("istanbul", { label: "İstanbul" })).toBe(true);
    expect(filter("ADIYA", { label: "Adıyaman" })).toBe(true);
    expect(filter("adana", { label: "İstanbul" })).toBe(false);
  });

  it("renders a working native select on its own", async () => {
    function Fields() {
      const address = useViraAddress({ source });
      return (
        <>
          <select data-testid="province" {...address.getProvinceProps({ as: "native" })} />
          <select data-testid="district" {...address.getDistrictProps({ as: "native" })} />
        </>
      );
    }
    render(<Fields />);
    const province = screen.getByTestId<HTMLSelectElement>("province");
    const district = screen.getByTestId<HTMLSelectElement>("district");

    expect([...province.options].map((o) => o.text)).toEqual(["İl seçiniz", "Adana", "Adıyaman", "İstanbul"]);
    expect(district.disabled).toBe(true);

    await userEvent.selectOptions(province, "34");
    expect(province.value).toBe("34");
    expect([...district.options].map((o) => o.value)).toEqual(["", "FATİH", "KADIKÖY"]);
  });

  it("accepts a change event as well as a bare value", () => {
    const { result } = renderHook(() => useViraAddress({ source }));

    act(() => (result.current.getProvinceProps().onChange as (next: unknown) => void)({ target: { value: "1" } }));
    expect(result.current.value.province).toBe("ADANA");

    act(() => (result.current.getProvinceProps().onChange as (next: unknown) => void)("34"));
    expect(result.current.value.province).toBe("İSTANBUL");
  });

  it("exposes the postal code as a hidden input", async () => {
    const { result } = renderHook(() => useViraAddress({ source }));
    act(() => result.current.setProvince(1));
    await waitFor(() => expect(result.current.loading.neighbourhoods).toBe(false));
    act(() => result.current.setDistrict("SEYHAN"));
    act(() => result.current.setNeighbourhood("AKKAPI MAH."));

    expect(result.current.getPostalCodeProps()).toMatchObject({ type: "hidden", name: "postalCode", value: "01040" });
  });
});
