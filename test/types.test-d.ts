import { useForm } from "react-hook-form";
import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";
import {
  createMask,
  definePreset,
  maskResolver,
  parseMasked,
  useViraMask,
  type ErrorKey,
  type MaskField,
  type MaskOptions,
  type Preset,
} from "../src";

describe("types", () => {
  it("infers field names from the form", () => {
    const form = useForm<{ phone: string; card: string; cvv: string; address: { zip: string } }>();
    const fields = useViraMask(form, {
      phone: "phoneTR",
      card: "card",
      cvv: { preset: "cvv", from: "card" },
      zip: { name: "address.zip", mask: "99999" },
    });
    expectTypeOf(fields).toEqualTypeOf<{
      readonly phone: MaskField;
      readonly card: MaskField;
      readonly cvv: MaskField;
      readonly zip: MaskField;
    }>();
  });

  it("infers through inline callbacks", () => {
    const form = useForm<{ card: string; phone: string }>();
    const { card, phone } = useViraMask(form, {
      card: { preset: "card", onComplete: (value) => expectTypeOf(value).toEqualTypeOf<string>() },
      phone: { preset: "phoneTR", rules: { validate: (value) => value !== "" || "required" } },
    });
    expectTypeOf(card).toEqualTypeOf<MaskField>();
    expectTypeOf(phone).toEqualTypeOf<MaskField>();
  });

  it("rejects unknown keys, unknown `from` and unknown `name`", () => {
    const form = useForm<{ phone: string; card: string }>();
    // @ts-expect-error "phon" is not a field
    useViraMask(form, { phon: "phoneTR" });
    // @ts-expect-error "crd" is not a field
    useViraMask(form, { phone: { preset: "cvv", from: "crd" } });
    // @ts-expect-error "address.zip" is not a field
    useViraMask(form, { zip: { name: "address.zip", mask: "99999" } });
  });

  it("rejects unknown presets and mismatched overrides", () => {
    const form = useForm<{ phone: string }>();
    // @ts-expect-error not a preset
    useViraMask(form, { phone: "phonee" });
    // @ts-expect-error a pattern preset has no date options
    useViraMask(form, { phone: { preset: "phoneTR", date: { min: "today" } } });
  });

  it("mask and currency can't be combined", () => {
    // @ts-expect-error mask + currency
    const bad: MaskOptions = { mask: "999", currency: "TRY" };
    void bad;
    createMask({ currency: { code: "USD" } });
    createMask({ number: { min: 0, max: 10 } });
  });

  it("types rules with the form values", () => {
    const form = useForm<{ age: string }>();
    useViraMask(form, { age: { preset: "number", rules: { required: true, minLength: 1 } } });
    // @ts-expect-error unknown rule
    useViraMask(form, { age: { preset: "number", rules: { requird: true } } });
  });

  it("works with a Zod resolver's input/output types", () => {
    const schema = z.object({ phone: z.string(), price: z.string().transform(Number) });
    const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
      resolver: maskResolver({ phone: "phoneTR" }, schema),
    });
    const { phone, price } = useViraMask(form, { phone: "phoneTR", price: "currency" });
    expectTypeOf(phone).toEqualTypeOf<MaskField>();
    expectTypeOf(price.onChange).toBeFunction();
  });

  it("definePreset keeps its kind", () => {
    const plate = definePreset("plate", { mask: "99 a 999" });
    expectTypeOf(plate).toEqualTypeOf<Preset<"pattern">>();
    const money = definePreset("money", { currency: "EUR" });
    expectTypeOf(money).toEqualTypeOf<Preset<"currency">>();
    const form = useForm<{ plate: string }>();
    useViraMask(form, { plate: { preset: plate, transform: "uppercase" } });
  });

  it("error keys and parse results", () => {
    expectTypeOf(createMask("tckn").validate("1")).toEqualTypeOf<ErrorKey | undefined>();
    const result = parseMasked({ phone: "phoneTR", zip: { name: "address.zip", mask: "99999" } }, {});
    if (result.success) expectTypeOf(result.data.phone).toEqualTypeOf<string>();
    else expectTypeOf(result.errors).toEqualTypeOf<Record<string, string>>();
  });
});
