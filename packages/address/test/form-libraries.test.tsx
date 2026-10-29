import { useForm as useTanStackForm } from "@tanstack/react-form";
import { act, cleanup, render, renderHook, waitFor } from "@testing-library/react";
import { Formik, type FormikProps, useFormikContext } from "formik";
import { createRef } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { useViraAddress, type UseViraAddressReturn } from "../src/index.js";
import { makeSource } from "./fixture.js";

// The recipes in the docs, run against the real libraries.

afterEach(cleanup);

interface Values {
  province: string;
  district: string;
  neighbourhood: string;
  postalCode: string;
}

const source = makeSource();
const EMPTY: Values = { province: "", district: "", neighbourhood: "", postalCode: "" };
const PICKED: Values = { province: "İSTANBUL", district: "FATİH", neighbourhood: "AKSARAY MAH.", postalCode: "34096" };

async function pickAksaray(address: () => UseViraAddressReturn) {
  act(() => address().setProvince(34));
  await waitFor(() => expect(address().loading.neighbourhoods).toBe(false));
  act(() => address().setDistrict("FATİH"));
  act(() => address().setNeighbourhood("AKSARAY MAH."));
}

describe("Formik", () => {
  function setup() {
    const formik = createRef<FormikProps<Values>>();
    const address = { current: null as UseViraAddressReturn | null };

    function Fields() {
      const { setFieldValue } = useFormikContext<Values>();
      address.current = useViraAddress({
        source,
        form: { setValue: (name, value) => setFieldValue(name, value) },
      });
      return (
        <>
          <select data-testid="province" {...address.current.getProvinceProps()} />
          <select data-testid="district" {...address.current.getDistrictProps()} />
        </>
      );
    }

    const view = render(
      <Formik innerRef={formik} initialValues={EMPTY} onSubmit={() => {}}>
        <Fields />
      </Formik>,
    );
    return { view, values: () => formik.current!.values, address: () => address.current! };
  }

  it("fills the form through a setValue adapter", async () => {
    const { values, address } = setup();

    await pickAksaray(address);
    await waitFor(() => expect(values()).toEqual(PICKED));
  });

  it("clears the levels below a new province in the form too", async () => {
    const { values, address } = setup();

    await pickAksaray(address);
    act(() => address().setProvince(1));
    await waitFor(() => expect(values()).toEqual({ ...EMPTY, province: "ADANA" }));
  });

  it("keeps the native selects in step", async () => {
    const { view, address } = setup();

    await pickAksaray(address);
    expect((view.getByTestId("province") as HTMLSelectElement).value).toBe("34");
    expect((view.getByTestId("district") as HTMLSelectElement).value).toBe("FATİH");
  });
});

describe("TanStack Form", () => {
  function setup() {
    return renderHook(() => {
      const form = useTanStackForm({ defaultValues: EMPTY });
      const address = useViraAddress({
        source,
        onChange: (value) => {
          form.setFieldValue("province", value.province ?? "");
          form.setFieldValue("district", value.district ?? "");
          form.setFieldValue("neighbourhood", value.neighbourhood ?? "");
          form.setFieldValue("postalCode", value.postalCode ?? "");
        },
      });
      return { form, address };
    });
  }

  it("fills the form from onChange", async () => {
    const { result } = setup();

    await pickAksaray(() => result.current.address);
    await waitFor(() => expect(result.current.form.state.values).toEqual(PICKED));
  });

  it("clears the levels below a new province in the form too", async () => {
    const { result } = setup();

    await pickAksaray(() => result.current.address);
    act(() => result.current.address.setProvince(1));
    await waitFor(() => expect(result.current.form.state.values).toEqual({ ...EMPTY, province: "ADANA" }));
  });
});
