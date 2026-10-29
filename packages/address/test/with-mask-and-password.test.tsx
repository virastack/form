// Mask, password and address in one React Hook Form: the checkout the site promises.
// Runs against the workspace builds of @virastack/mask and @virastack/password.
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm, type UseFormReturn } from "react-hook-form";
import { useViraMask } from "@virastack/mask";
import { mergeProps, useViraPassword } from "@virastack/password";
import { afterEach, describe, expect, it } from "vitest";

import { useViraAddress } from "../src/index.js";
import { makeSource } from "./fixture.js";

interface Values {
  tckn: string;
  phone: string;
  password: string;
  province: string;
  district: string;
  neighbourhood: string;
  postalCode: string;
}

const EMPTY: Values = { tckn: "", phone: "", password: "", province: "", district: "", neighbourhood: "", postalCode: "" };
const STRONG = "vu7#Kq2!mz9@Lw4X";
const source = makeSource();

afterEach(cleanup);

describe("with @virastack/mask and @virastack/password", () => {
  let form!: UseFormReturn<Values>;
  function Checkout() {
    form = useForm<Values>({ defaultValues: EMPTY, mode: "onChange" });
    const { tckn, phone } = useViraMask(form, {
      tckn: { preset: "tckn" },
      phone: { preset: "phone", country: "TR" },
    });
    const pw = useViraPassword({ value: form.watch("password") });
    const address = useViraAddress({ source, form });
    return (
      <form>
        <input aria-label="TCKN" {...tckn} />
        <input aria-label="Phone" {...phone} />
        <input aria-label="Password" {...mergeProps(pw.inputProps, form.register("password", pw.rule))} />
        <select aria-label="Province" {...address.getProvinceProps()} />
        <select aria-label="District" {...address.getDistrictProps()} />
        <select aria-label="Neighbourhood" {...address.getNeighbourhoodProps()} />
      </form>
    );
  }

  const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement & HTMLSelectElement;

  it("fill one form, each hook writing its own fields", async () => {
    render(<Checkout />);
    await userEvent.type(field("TCKN"), "10000000146");
    await userEvent.type(field("Phone"), "05551234567");
    await userEvent.type(field("Password"), STRONG);
    await userEvent.selectOptions(field("Province"), "34");
    await waitFor(() => expect(field("District").disabled).toBe(false));
    await userEvent.selectOptions(field("District"), "FATİH");
    await waitFor(() => expect(field("Neighbourhood").disabled).toBe(false));
    await userEvent.selectOptions(field("Neighbourhood"), "AKSARAY MAH.");

    expect(field("Phone").value).toBe("(555) 123 45 67");
    await waitFor(() =>
      expect(form.getValues()).toEqual({
        tckn: "10000000146",
        phone: "5551234567",
        password: STRONG,
        province: "İSTANBUL",
        district: "FATİH",
        neighbourhood: "AKSARAY MAH.",
        postalCode: "34096",
      }),
    );
  });

  it("an edit form starts filled, and form.reset() clears all three", async () => {
    const filled: Values = {
      tckn: "10000000146",
      phone: "5551234567",
      password: STRONG,
      province: "İSTANBUL",
      district: "FATİH",
      neighbourhood: "AKSARAY MAH.",
      postalCode: "34096",
    };
    function EditCheckout() {
      form = useForm<Values>({ defaultValues: filled });
      const { phone } = useViraMask(form, { phone: { preset: "phone", country: "TR" } });
      const address = useViraAddress({ source, form });
      return (
        <form>
          <input aria-label="Phone" {...phone} />
          <select aria-label="Neighbourhood" {...address.getNeighbourhoodProps()} />
        </form>
      );
    }
    render(<EditCheckout />);
    expect(field("Phone").value).toBe("(555) 123 45 67");
    await waitFor(() => expect(field("Neighbourhood").value).toBe("AKSARAY MAH."));

    act(() => form.reset(EMPTY));
    expect(field("Phone").value).toBe("");
    await waitFor(() => expect(form.getValues()).toEqual(EMPTY));
  });
});
