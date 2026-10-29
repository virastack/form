import { describe, expect, it } from "vitest";

import { matchPostalCode, normalizePostalCode, provinceCodeOf } from "../src/core/postal.js";
import type { AddressNeighbourhood } from "../src/core/types.js";

const n = (name: string, ...postalCodes: string[]): AddressNeighbourhood => ({
  name,
  postalCode: postalCodes[0] ?? "",
  postalCodes,
});

describe("normalizePostalCode", () => {
  it("takes five digits as they are", () => {
    expect(normalizePostalCode("34096")).toBe("34096");
    expect(normalizePostalCode("01040")).toBe("01040");
    expect(normalizePostalCode(34096)).toBe("34096");
  });

  it("drops spaces from a pasted code", () => {
    expect(normalizePostalCode(" 34096 ")).toBe("34096");
    expect(normalizePostalCode("34 096")).toBe("34096");
  });

  it("refuses anything that is not five digits", () => {
    expect(normalizePostalCode("3409")).toBeNull();
    expect(normalizePostalCode("340960")).toBeNull();
    expect(normalizePostalCode("34O96")).toBeNull();
    expect(normalizePostalCode("34-096")).toBeNull();
    expect(normalizePostalCode("")).toBeNull();
    expect(normalizePostalCode(null)).toBeNull();
    expect(normalizePostalCode(undefined)).toBeNull();
  });

  it("cannot bring back a leading zero a number lost", () => {
    // 01040 as a number is 1040; forms should send postal codes as text.
    expect(normalizePostalCode(1040)).toBeNull();
  });
});

describe("provinceCodeOf", () => {
  it("reads the plate from the first two digits", () => {
    expect(provinceCodeOf("34096")).toBe(34);
    expect(provinceCodeOf("01040")).toBe(1);
    expect(provinceCodeOf("81000")).toBe(81);
  });
});

describe("matchPostalCode", () => {
  const byDistrict = new Map([
    ["SEYHAN", [n("AKKAPI MAH.", "01040"), n("ALTINŞEHİR MAH.", "01170"), n("DAĞLIOĞLU MAH.", "01040")]],
    ["CEYHAN", [n("BAHÇE MAH.", "01950")]],
    ["KOZAN", [n("ÇOK KODLU MAH.", "01500", "01510")]],
  ]);

  it("finds the district and every neighbourhood under the code", () => {
    expect(matchPostalCode(byDistrict, "01040")).toEqual([
      { district: "SEYHAN", neighbourhoods: [n("AKKAPI MAH.", "01040"), n("DAĞLIOĞLU MAH.", "01040")] },
    ]);
  });

  it("finds a neighbourhood by any of its codes, not only the first", () => {
    expect(matchPostalCode(byDistrict, "01510")).toEqual([
      { district: "KOZAN", neighbourhoods: [n("ÇOK KODLU MAH.", "01500", "01510")] },
    ]);
  });

  it("lists each district when a code spans several", () => {
    const spread = new Map([
      ["A", [n("BİR MAH.", "01000")]],
      ["B", [n("İKİ MAH.", "01000")]],
      ["C", [n("ÜÇ MAH.", "01001")]],
    ]);
    expect(matchPostalCode(spread, "01000").map((hit) => hit.district)).toEqual(["A", "B"]);
  });

  it("finds nothing for a code no neighbourhood has", () => {
    expect(matchPostalCode(byDistrict, "01999")).toEqual([]);
    expect(matchPostalCode(new Map(), "01040")).toEqual([]);
  });
});
