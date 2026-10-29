import { describe, expect, it } from "vitest";

import { compareNames, formatAddress, formatName, toSearchKey } from "../src/core/format.js";

describe("formatName", () => {
  it("lower-cases the Turkish way", () => {
    // A naive toLowerCase turns the dotted I into "i" instead of "ı".
    expect(formatName("AKKAPI MAH.")).toBe("Akkapı Mah.");
    expect(formatName("İSTANBUL")).toBe("İstanbul");
    expect(formatName("KADIKÖY")).toBe("Kadıköy");
  });

  it("capitalises after separators", () => {
    expect(formatName("ŞEHİT P. ÜSTEĞMEN MAH.")).toBe("Şehit P. Üsteğmen Mah.");
    expect(formatName("GAZİ-OSMAN MAH.")).toBe("Gazi-Osman Mah.");
  });
});

describe("toSearchKey", () => {
  it("ignores case and Turkish diacritics", () => {
    expect(toSearchKey("KADIKÖY")).toBe("kadikoy");
    expect(toSearchKey("Çağlayan")).toBe("caglayan");
    expect(toSearchKey("ŞİŞLİ")).toBe(toSearchKey("sisli"));
  });
});

describe("compareNames", () => {
  it("sorts the Turkish alphabet", () => {
    expect(["İZMİR", "ADANA", "ÇORUM"].sort(compareNames)).toEqual(["ADANA", "ÇORUM", "İZMİR"]);
  });
});

describe("formatAddress", () => {
  const value = {
    provinceCode: "54",
    province: "SAKARYA",
    district: "ADAPAZARI",
    neighbourhood: "ALANDÜZÜ MAH.",
    postalCode: "54100",
    postalCodes: ["54100"],
  };

  it("puts the neighbourhood before district/province, Turkish cased", () => {
    expect(formatAddress(value)).toBe("Alandüzü Mah. Adapazarı/Sakarya");
  });

  it("adds the postal code before the district when asked", () => {
    expect(formatAddress(value, { postalCode: true })).toBe("Alandüzü Mah. 54100 Adapazarı/Sakarya");
  });

  it("takes another separator", () => {
    expect(formatAddress(value, { separator: ", " })).toBe("Alandüzü Mah. Adapazarı, Sakarya");
    expect(formatAddress(value, { separator: " / ", postalCode: true })).toBe("Alandüzü Mah. 54100 Adapazarı / Sakarya");
  });

  it("leaves out the levels not picked yet", () => {
    expect(formatAddress({ province: "İSTANBUL" })).toBe("İstanbul");
    expect(formatAddress({ province: "İSTANBUL", district: "KADIKÖY" })).toBe("Kadıköy/İstanbul");
    expect(formatAddress({ province: "İSTANBUL", district: "KADIKÖY", postalCode: "34710" }, { postalCode: true })).toBe(
      "34710 Kadıköy/İstanbul",
    );
    expect(formatAddress({ ...value, postalCode: null }, { postalCode: true })).toBe("Alandüzü Mah. Adapazarı/Sakarya");
  });

  it("gives an empty string for an empty address", () => {
    expect(formatAddress({})).toBe("");
    expect(formatAddress({ province: null, district: null, neighbourhood: null, postalCode: null }, { postalCode: true })).toBe("");
  });

  it("keeps a district called MERKEZ readable", () => {
    expect(formatAddress({ province: "ADIYAMAN", district: "MERKEZ", neighbourhood: "CUMHURİYET MAH." })).toBe(
      "Cumhuriyet Mah. Merkez/Adıyaman",
    );
  });

  it("handles the dotted and dotless I in every level", () => {
    expect(formatAddress({ province: "KIRŞEHİR", district: "KAMAN", neighbourhood: "IŞIKLI MAH." })).toBe(
      "Işıklı Mah. Kaman/Kırşehir",
    );
  });

  it("formats names however they were cased", () => {
    expect(formatAddress({ province: "istanbul", district: "fatih", neighbourhood: "aksaray mah." })).toBe(
      "Aksaray Mah. Fatih/İstanbul",
    );
  });
});
