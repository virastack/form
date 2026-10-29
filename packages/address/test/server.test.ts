import { describe, expect, it } from "vitest";

import { setLoader } from "../src/data.js";
import { districtsOf, findProvince, formatAddress, postalCodeFor, resolveAddress, resolvePostalCode } from "../src/server.js";

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

describe("loading", () => {
  it("reads a province once, however many requests ask for it", async () => {
    const reads: number[] = [];
    setLoader(async (code) => {
      reads.push(code);
      return code === 34 ? "FATİH;AKSARAY MAH.:34096|BALAT MAH.:34087" : "";
    });
    const request = { provinceCode: 34, district: "FATİH", neighbourhood: "AKSARAY MAH." };

    await resolveAddress(request);
    await resolveAddress(request);
    await Promise.all([resolveAddress(request), resolveAddress({ ...request, neighbourhood: "BALAT MAH." })]);
    expect(reads).toEqual([34]);
    setLoader(null);
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

describe("resolveAddress with a postal code", () => {
  const fatih = { province: "İSTANBUL", district: "FATİH", neighbourhood: "AKSARAY MAH." };

  it("accepts the code the neighbourhood has", async () => {
    const result = await resolveAddress({ ...fatih, postalCode: "34096" });
    expect(result.ok).toBe(true);
    expect(result.value.postalCode).toBe("34096");
  });

  it("keeps the code that was sent when the neighbourhood has several", async () => {
    const result = await resolveAddress({
      province: "ADIYAMAN",
      district: "GÖLBAŞI",
      neighbourhood: "CUMHURİYET MAH.",
      postalCode: "02540",
    });
    expect(result.ok).toBe(true);
    expect(result.value.postalCode).toBe("02540");
    expect(result.value.postalCodes).toEqual(["02530", "02540", "02520"]);
  });

  it("refuses a code from somewhere else", async () => {
    const result = await resolveAddress({ ...fatih, postalCode: "34710" });
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([{ level: "postalCode", reason: "mismatch" }]);
    // The address itself still resolves, with the code it really has.
    expect(result.value).toMatchObject({ neighbourhood: "AKSARAY MAH.", postalCode: "34096" });
  });

  it("refuses a code that is not a code", async () => {
    expect((await resolveAddress({ ...fatih, postalCode: "abc" })).issues).toEqual([{ level: "postalCode", reason: "mismatch" }]);
  });

  it("accepts a code with spaces", async () => {
    expect((await resolveAddress({ ...fatih, postalCode: " 34 096 " })).ok).toBe(true);
  });

  it("derives the code when none or an empty one was sent", async () => {
    expect((await resolveAddress({ ...fatih, postalCode: "" })).value.postalCode).toBe("34096");
    expect((await resolveAddress({ ...fatih, postalCode: null })).value.postalCode).toBe("34096");
  });

  it("checks the levels before the code", async () => {
    const result = await resolveAddress({ province: "İSTANBUL", district: "FATİH", postalCode: "99999" });
    expect(result.issues).toEqual([{ level: "neighbourhood", reason: "missing" }]);
  });
});

describe("resolvePostalCode", () => {
  it("gives the whole address for a code with one neighbourhood", async () => {
    expect(await resolvePostalCode("34710")).toEqual({
      ok: true,
      issues: [],
      neighbourhoods: ["CAFERAĞA MAH."],
      value: {
        provinceCode: "34",
        province: "İSTANBUL",
        district: "KADIKÖY",
        neighbourhood: "CAFERAĞA MAH.",
        postalCode: "34710",
        postalCodes: ["34710"],
      },
    });
  });

  it("stops at the district and lists the candidates for a shared code", async () => {
    expect(await resolvePostalCode("34096")).toEqual({
      ok: false,
      issues: [{ level: "neighbourhood", reason: "missing" }],
      neighbourhoods: ["AKSARAY MAH.", "HASEKİ SULTAN MAH."],
      value: {
        provinceCode: "34",
        province: "İSTANBUL",
        district: "FATİH",
        neighbourhood: null,
        postalCode: "34096",
        postalCodes: ["34096"],
      },
    });
  });

  it("keeps the asked code over a neighbourhood's first", async () => {
    // ÖRNEK MAH. is the only one with 03217 alone, but ATATÜRK and CUMHURİYET carry it too.
    const result = await resolvePostalCode("03217");
    expect(result.neighbourhoods).toEqual(["ATATÜRK MAH.", "CUMHURİYET MAH.", "ÖRNEK MAH."]);
    expect(result.value.postalCode).toBe("03217");
  });

  it("says why nothing was found", async () => {
    const empty = { ok: false, neighbourhoods: [], value: expect.objectContaining({ province: null }) };
    expect(await resolvePostalCode("")).toEqual({ ...empty, issues: [{ level: "postalCode", reason: "missing" }] });
    expect(await resolvePostalCode(null)).toEqual({ ...empty, issues: [{ level: "postalCode", reason: "missing" }] });
    expect(await resolvePostalCode("  ")).toEqual({ ...empty, issues: [{ level: "postalCode", reason: "missing" }] });
    expect(await resolvePostalCode("34999")).toEqual({ ...empty, issues: [{ level: "postalCode", reason: "unknown" }] });
    expect(await resolvePostalCode("99000")).toEqual({ ...empty, issues: [{ level: "postalCode", reason: "unknown" }] });
    expect(await resolvePostalCode("3409")).toEqual({ ...empty, issues: [{ level: "postalCode", reason: "unknown" }] });
  });

  it("agrees with resolveAddress on the address it found", async () => {
    const found = await resolvePostalCode("06130");
    const checked = await resolveAddress({ ...found.value, postalCode: found.value.postalCode });
    expect(checked).toEqual({ ok: true, issues: [], value: found.value });
  });

  it("feeds formatAddress", async () => {
    const { value } = await resolvePostalCode("34710");
    expect(formatAddress(value, { postalCode: true })).toBe("Caferağa Mah. 34710 Kadıköy/İstanbul");
  });
});
