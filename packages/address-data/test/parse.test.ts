import { describe, expect, it } from "vitest";

import { neighbourhoods, setLoader } from "../src/index.js";

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
});
