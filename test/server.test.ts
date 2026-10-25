import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import * as server from "../src/server";
import { parseMasked } from "../src/server";

const masks = {
  phone: "phoneTR",
  card: "card",
  cvv: { preset: "cvv", from: "card" },
  price: { preset: "currency", from: "code" },
  birth: { preset: "date", date: { max: "today", minAge: 18 } },
  zip: { name: "address.zip", mask: "99999" },
} as const;

function formData(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

describe("@virastack/mask/server", () => {
  it("exports no React code", () => {
    expect(Object.keys(server)).not.toContain("useViraMask");
    expect(Object.keys(server)).toContain("parseMasked");
  });

  it("parses masked FormData into raw values", () => {
    const result = parseMasked(
      masks,
      formData({
        phone: "(555) 123 45 67",
        card: "3782 822463 10005",
        cvv: "1234",
        code: "USD",
        price: "$1,234.56",
        birth: "01/02/1990",
        "address.zip": "34000",
        note: "kept",
      }),
    );
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      phone: "5551234567",
      card: "378282246310005",
      cvv: "1234",
      code: "USD",
      price: "1234.56",
      birth: "1990-02-01",
      address: { zip: "34000" },
      note: "kept",
    });
  });

  it("returns error keys", () => {
    const result = parseMasked(masks, { phone: "555", card: "4111 1111 1111 1112", birth: "01/02/2020" });
    expect(result.success).toBe(false);
    expect(result.errors).toEqual({
      phone: "phoneTR.incomplete",
      card: "card.invalid",
      birth: "date.minAge",
    });
  });

  it("validates the parsed data with Zod (Standard Schema)", async () => {
    const schema = z.object({
      phone: z.string().length(10),
      price: z.string().transform(Number),
      code: z.enum(["TRY", "USD"]),
    });
    const ok = await parseMasked({ phone: "phoneTR", price: { preset: "currency", from: "code" } }, {
      phone: "(555) 123 45 67",
      price: "₺1.234,5",
      code: "TRY",
    }, schema);
    expect(ok).toEqual({ success: true, data: { phone: "5551234567", price: 1234.5, code: "TRY" } });

    const bad = await parseMasked({ phone: "phoneTR" }, { phone: "555", price: "1", code: "EUR" }, schema);
    expect(bad.success).toBe(false);
    expect(bad.errors).toMatchObject({ phone: "phoneTR.incomplete", code: expect.any(String) });
  });

  it("validates with Valibot (Standard Schema)", async () => {
    const schema = v.object({ tckn: v.string() });
    const result = await parseMasked({ tckn: "tckn" }, { tckn: "10000000146" }, schema);
    expect(result).toEqual({ success: true, data: { tckn: "10000000146" } });
  });

  it("masked output fields stay masked", () => {
    const result = parseMasked({ phone: { preset: "phoneTR", output: "masked" } }, { phone: "5551234567" });
    expect(result.data.phone).toBe("(555) 123 45 67");
  });
});
