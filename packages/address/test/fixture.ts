import type { AddressNeighbourhood, AddressSource } from "../src/core/types.js";

const one = (name: string, postalCode: string): AddressNeighbourhood => ({
  name,
  postalCode,
  postalCodes: [postalCode],
});

const NEIGHBOURHOODS: Record<number, Record<string, AddressNeighbourhood[]>> = {
  1: {
    // AKKAPI and DAĞLIOĞLU share 01040, as many neighbourhoods share a code.
    SEYHAN: [one("AKKAPI MAH.", "01040"), one("ALTINŞEHİR MAH.", "01170"), one("DAĞLIOĞLU MAH.", "01040")],
    CEYHAN: [one("BAHÇE MAH.", "01950")],
  },
  2: {
    // A neighbourhood split across several postal codes, as a few hundred are.
    MERKEZ: [{ name: "CUMHURİYET MAH.", postalCode: "02290", postalCodes: ["02290", "02010", "02040"] }],
  },
  34: {
    FATİH: [one("AKSARAY MAH.", "34096")],
    KADIKÖY: [one("CAFERAĞA MAH.", "34710")],
  },
};

export function makeSource(overrides: Partial<AddressSource> = {}): AddressSource {
  return {
    provinces: [
      { code: 34, name: "İSTANBUL", districts: ["KADIKÖY", "FATİH"] },
      { code: 1, name: "ADANA", districts: ["SEYHAN", "CEYHAN"] },
      { code: 2, name: "ADIYAMAN", districts: ["MERKEZ"] },
    ],
    neighbourhoods: async (code) => new Map(Object.entries(NEIGHBOURHOODS[code] ?? {})),
    ...overrides,
  };
}

/** A source whose loads resolve only when the test says so. */
export function makeDeferredSource() {
  const pending: { code: number; resolve: (value: Map<string, AddressNeighbourhood[]>) => void }[] = [];
  const source = makeSource({
    neighbourhoods: (code) =>
      new Promise((resolve) => {
        pending.push({ code, resolve });
      }),
  });
  return { source, pending };
}
