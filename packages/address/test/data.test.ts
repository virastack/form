import { describe, expect, it } from "vitest";

import { districts, neighbourhoods, province, provinces, setLoader, source } from "../src/data.js";

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
