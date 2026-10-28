import { describe, expect, it } from "vitest";

import { districtsOf, findProvince, postalCodeFor, resolveAddress } from "../src/server.js";

describe("findProvince", () => {
  it("takes a plate code in any of the ways forms send it", () => {
    expect(findProvince(6)?.name).toBe("ANKARA");
    expect(findProvince("6")?.name).toBe("ANKARA");
    expect(findProvince("06")?.name).toBe("ANKARA");
  });

  it("takes a name however it was cased", () => {
    expect(findProvince("istanbul")?.code).toBe(34);
    expect(findProvince("İSTANBUL")?.code).toBe(34);
    expect(findProvince("Kırşehir")?.code).toBe(40);
  });

  it("finds nothing for nothing", () => {
    expect(findProvince("")).toBeUndefined();
    expect(findProvince(null)).toBeUndefined();
    expect(findProvince(99)).toBeUndefined();
  });
});

describe("resolveAddress", () => {
  it("derives the postal code from the dataset", async () => {
    const result = await resolveAddress({ province: "istanbul", district: "fatih", neighbourhood: " aksaray mah. " });
    expect(result).toEqual({
      ok: true,
      issues: [],
      value: {
        provinceCode: "34",
        province: "İSTANBUL",
        district: "FATİH",
        neighbourhood: "AKSARAY MAH.",
        postalCode: "34096",
        postalCodes: ["34096"],
      },
    });
  });

  it("falls back to the name when the code field came in empty", async () => {
    const result = await resolveAddress({ provinceCode: "", province: "İstanbul", district: "FATİH", neighbourhood: "AKSARAY MAH." });
    expect(result.ok).toBe(true);
  });

  it("says which level is missing or unknown", async () => {
    expect((await resolveAddress({})).issues).toEqual([{ level: "province", reason: "missing" }]);
    expect((await resolveAddress({ province: "Atlantis" })).issues).toEqual([{ level: "province", reason: "unknown" }]);
    expect((await resolveAddress({ provinceCode: 34 })).issues).toEqual([{ level: "district", reason: "missing" }]);
    expect((await resolveAddress({ provinceCode: 34, district: "ÇANKAYA" })).issues).toEqual([
      { level: "district", reason: "unknown" },
    ]);
    expect((await resolveAddress({ provinceCode: 34, district: "FATİH" })).issues).toEqual([
      { level: "neighbourhood", reason: "missing" },
    ]);

    const wrong = await resolveAddress({ provinceCode: 34, district: "FATİH", neighbourhood: "YOK MAH." });
    expect(wrong.issues).toEqual([{ level: "neighbourhood", reason: "unknown" }]);
    // What was right is kept, so a form can show the rest of the address.
    expect(wrong.value).toMatchObject({ province: "İSTANBUL", district: "FATİH", postalCode: null });
  });

  it("keeps every postal code of a neighbourhood that has several", async () => {
    const { value } = await resolveAddress({ provinceCode: 2, district: "BESNİ", neighbourhood: "CUMHURİYET MAH." });
    expect(value.postalCode).toBe("02348");
    expect(value.postalCodes).toEqual(["02348", "02340", "02330"]);
  });
});

describe("helpers", () => {
  it("returns a single postal code", async () => {
    expect(await postalCodeFor({ provinceCode: "34", district: "FATİH", neighbourhood: "AKSARAY MAH." })).toBe("34096");
    expect(await postalCodeFor({ provinceCode: "34" })).toBeNull();
  });

  it("sorts a province's districts the Turkish way", () => {
    const ankara = districtsOf("06");
    expect(ankara[0]).toBe("AKYURT");
    expect(ankara).toContain("ÇANKAYA");
    expect(districtsOf("Atlantis")).toEqual([]);
  });
});
