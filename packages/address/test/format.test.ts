import { describe, expect, it } from "vitest";

import { compareTr, foldTr, titleCaseTr } from "../src/core/format.js";

describe("titleCaseTr", () => {
  it("lower-cases the Turkish way", () => {
    // A naive toLowerCase turns the dotted I into "i" instead of "ı".
    expect(titleCaseTr("AKKAPI MAH.")).toBe("Akkapı Mah.");
    expect(titleCaseTr("İSTANBUL")).toBe("İstanbul");
    expect(titleCaseTr("KADIKÖY")).toBe("Kadıköy");
  });

  it("capitalises after separators", () => {
    expect(titleCaseTr("ŞEHİT P. ÜSTEĞMEN MAH.")).toBe("Şehit P. Üsteğmen Mah.");
    expect(titleCaseTr("GAZİ-OSMAN MAH.")).toBe("Gazi-Osman Mah.");
  });
});

describe("foldTr", () => {
  it("ignores case and Turkish diacritics", () => {
    expect(foldTr("KADIKÖY")).toBe("kadikoy");
    expect(foldTr("Çağlayan")).toBe("caglayan");
    expect(foldTr("ŞİŞLİ")).toBe(foldTr("sisli"));
  });
});

describe("compareTr", () => {
  it("sorts the Turkish alphabet", () => {
    expect(["İZMİR", "ADANA", "ÇORUM"].sort(compareTr)).toEqual(["ADANA", "ÇORUM", "İZMİR"]);
  });
});
