import { describe, expect, it } from "vitest";

import { districts, findPostalCode, neighbourhoods, province, provinces, setLoader, source } from "../src/data.js";

describe("neighbourhoods", () => {
  it("parses the encoded payload and caches the province", async () => {
    let calls = 0;
    setLoader(async () => {
      calls++;
      return "SEYHAN;AKKAPI MAH.:01040|ALTINŞEHİR MAH.:01170\nCEYHAN;BAHÇE MAH.:01950";
    });

    const first = await neighbourhoods(1);
    expect([...first.keys()]).toEqual(["SEYHAN", "CEYHAN"]);
    expect(first.get("SEYHAN")).toEqual([
      { name: "AKKAPI MAH.", postalCode: "01040", postalCodes: ["01040"] },
      { name: "ALTINŞEHİR MAH.", postalCode: "01170", postalCodes: ["01170"] },
    ]);

    await neighbourhoods(1);
    expect(calls).toBe(1);

    setLoader(null);
  });

  it("keeps every postal code when a neighbourhood has several", async () => {
    setLoader(async () => "MERKEZ;CUMHURİYET MAH.:02290,02010,02040");
    const parsed = await neighbourhoods(2);
    expect(parsed.get("MERKEZ")).toEqual([
      { name: "CUMHURİYET MAH.", postalCode: "02290", postalCodes: ["02290", "02010", "02040"] },
    ]);
    setLoader(null);
  });

  it("keeps a comma that belongs to the name", async () => {
    setLoader(async () => "MERKEZ;AŞAĞI, YUKARI MAH.:06010");
    const parsed = await neighbourhoods(6);
    expect(parsed.get("MERKEZ")?.[0]).toEqual({ name: "AŞAĞI, YUKARI MAH.", postalCode: "06010", postalCodes: ["06010"] });
    setLoader(null);
  });

  it("handles a district with no neighbourhoods", async () => {
    setLoader(async () => "BOŞ;");
    const parsed = await neighbourhoods(99);
    expect(parsed.get("BOŞ")).toEqual([]);
    setLoader(null);
  });

  it("shares one load between callers asking at the same time", async () => {
    let calls = 0;
    setLoader(async () => {
      calls++;
      return "MERKEZ;A MAH.:03000";
    });
    const [a, b] = await Promise.all([neighbourhoods(3), neighbourhoods(3)]);
    expect(calls).toBe(1);
    expect(a).toBe(b);
    setLoader(null);
  });

  it("forgets what the previous loader read", async () => {
    setLoader(async () => "MERKEZ;ESKİ MAH.:04000");
    await neighbourhoods(4);
    setLoader(async () => "MERKEZ;YENİ MAH.:04010");
    expect((await neighbourhoods(4)).get("MERKEZ")?.[0]?.name).toBe("YENİ MAH.");
    setLoader(null);
  });

  it("retries a province whose load failed", async () => {
    let calls = 0;
    setLoader(async () => {
      calls++;
      if (calls === 1) throw new Error("offline");
      return "MERKEZ;A MAH.:05000";
    });
    await expect(neighbourhoods(5)).rejects.toThrow("offline");
    expect((await neighbourhoods(5)).get("MERKEZ")).toHaveLength(1);
    setLoader(null);
  });

  it("turns a throwing loader into a rejection", async () => {
    setLoader(() => {
      throw new Error("not async");
    });
    await expect(neighbourhoods(7)).rejects.toThrow("not async");
    setLoader(null);
  });
});

describe("bundled dataset", () => {
  it("lists every province with its districts", () => {
    expect(provinces).toHaveLength(81);
    expect(source).toMatchObject({ provinces: 81, districts: 973, neighbourhoods: 72466 });
    expect(province(34)?.name).toBe("İSTANBUL");
    expect(districts(34)).toContain("FATİH");
    expect(districts(99)).toEqual([]);
  });

  it("loads one province from the shipped modules", async () => {
    const istanbul = await neighbourhoods(34);
    expect(istanbul.get("FATİH")?.[0]).toEqual({ name: "AKSARAY MAH.", postalCode: "34096", postalCodes: ["34096"] });
  });

  it("gives an empty map for a code that is not a province", async () => {
    expect((await neighbourhoods(99)).size).toBe(0);
  });
});

describe("findPostalCode", () => {
  it("finds a code with one neighbourhood", async () => {
    const match = await findPostalCode("34710");
    expect(match).toMatchObject({ postalCode: "34710", province: { code: 34, name: "İSTANBUL" }, district: "KADIKÖY" });
    expect(match?.neighbourhoods.map((n) => n.name)).toEqual(["CAFERAĞA MAH."]);
  });

  it("lists every neighbourhood a shared code covers", async () => {
    const match = await findPostalCode("34096");
    expect(match?.district).toBe("FATİH");
    expect(match?.neighbourhoods.map((n) => n.name)).toEqual(["AKSARAY MAH.", "HASEKİ SULTAN MAH."]);
    expect((await findPostalCode("54100"))?.neighbourhoods.length).toBeGreaterThan(50);
  });

  it("finds a neighbourhood by a code that is not its first", async () => {
    const match = await findPostalCode("02540");
    expect(match?.district).toBe("GÖLBAŞI");
    expect(match?.neighbourhoods.map((n) => n.name)).toEqual(["CUMHURİYET MAH.", "MERKEZ MAH."]);
    expect(match?.neighbourhoods[0]?.postalCodes).toEqual(["02530", "02540", "02520"]);
  });

  it("keeps a leading zero and ignores spaces", async () => {
    expect((await findPostalCode("06130"))?.province.name).toBe("ANKARA");
    expect((await findPostalCode(" 34 710 "))?.district).toBe("KADIKÖY");
    expect((await findPostalCode(34710))?.district).toBe("KADIKÖY");
  });

  it("gives null for anything that is not a known code", async () => {
    expect(await findPostalCode("34999")).toBeNull();
    expect(await findPostalCode("99000")).toBeNull();
    expect(await findPostalCode("00000")).toBeNull();
    expect(await findPostalCode("3471")).toBeNull();
    expect(await findPostalCode("abcde")).toBeNull();
    expect(await findPostalCode("")).toBeNull();
  });

  it("loads only the province the code starts with", async () => {
    const asked: number[] = [];
    setLoader(async (code) => {
      asked.push(code);
      return "SEYHAN;AKKAPI MAH.:01040|DAĞLIOĞLU MAH.:01040";
    });
    expect((await findPostalCode("01040"))?.neighbourhoods).toHaveLength(2);
    expect(asked).toEqual([1]);
    setLoader(null);
  });

  it("finds every code in the dataset, in one district under its own plate", async () => {
    let codes = 0;
    for (const p of provinces) {
      const byDistrict = await neighbourhoods(p.code);
      const seen = new Map<string, string>();
      for (const [district, list] of byDistrict) {
        for (const n of list) for (const code of n.postalCodes) seen.set(code, district);
      }
      for (const [code, district] of seen) {
        const match = await findPostalCode(code);
        expect(match?.province.code).toBe(p.code);
        expect(match?.district).toBe(district);
        expect(match?.neighbourhoods.every((n) => n.postalCodes.includes(code))).toBe(true);
        codes++;
      }
    }
    expect(codes).toBe(2777);
  });
});
