// `@virastack/mask/testing`: generated values, seeds and the entry's boundaries.
import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as root from "../src";
import { createMask, getTurkishBank, isValidIBAN, isValidTCKN, turkishBanks } from "../src/core";
import { IBAN_LENGTHS, mod97, tcknCheckDigits } from "../src/core/validators";
import * as server from "../src/server";
import * as testing from "../src/testing";
import { generateIBAN, generateTCKN } from "../src/testing";
import { createRandom, randomDigits, randomInt } from "../src/testing/random";

const RUNS = { numRuns: Number(process.env.FC_RUNS ?? 300) };
const SAMPLES = 2_000;
const COUNTRIES = Object.keys(IBAN_LENGTHS);

/** The TCKN rule written out separately from the package, to check it against. */
function referenceTCKN(value: string): boolean {
  if (!/^[1-9]\d{10}$/.test(value)) return false;
  const d = [...value].map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  const tenth = (((odd * 7 - even) % 10) + 10) % 10;
  const eleventh = d.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10;
  return d[9] === tenth && d[10] === eleventh;
}

/** ISO 13616 with BigInt, independent of the package's digit-by-digit mod 97. */
function referenceIBAN(value: string): boolean {
  const rearranged = value.slice(4) + value.slice(0, 4);
  const numeric = [...rearranged].map((char) => (/[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char)).join("");
  return BigInt(numeric) % 97n === 1n;
}

afterEach(() => vi.restoreAllMocks());

describe("@virastack/mask/testing entry", () => {
  it("exports the generators and nothing else", () => {
    expect(Object.keys(testing).sort()).toEqual(["generateIBAN", "generateTCKN"]);
  });

  it("keeps the generators out of the main and server entries", () => {
    for (const entry of [root, server]) {
      expect(Object.keys(entry)).not.toContain("generateTCKN");
      expect(Object.keys(entry)).not.toContain("generateIBAN");
      expect(Object.keys(entry)).not.toContain("tcknCheckDigits");
      expect(Object.keys(entry)).not.toContain("mod97");
    }
  });
});

describe("seeded random", () => {
  it("gives the same sequence for the same seed and stream", () => {
    const a = createRandom(7, "x");
    const b = createRandom(7, "x");
    const first = Array.from({ length: 50 }, a);
    expect(Array.from({ length: 50 }, b)).toEqual(first);
    expect(first.every((n) => n >= 0 && n < 1)).toBe(true);
  });

  it("gives different sequences for other streams and seeds", () => {
    const take = (seed: number, stream: string) => Array.from({ length: 5 }, createRandom(seed, stream));
    expect(take(7, "x")).not.toEqual(take(7, "y"));
    expect(take(7, "x")).not.toEqual(take(8, "x"));
  });

  it("uses Math.random without a seed", () => {
    expect(createRandom(undefined, "x")).toBe(Math.random);
  });

  it("rejects seeds that are not integers", () => {
    for (const seed of [1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53]) {
      expect(() => createRandom(seed, "x")).toThrow(TypeError);
    }
    expect(() => createRandom(0, "x")).not.toThrow();
    expect(() => createRandom(-5, "x")).not.toThrow();
  });

  it("spreads integers and digits evenly", () => {
    const random = createRandom(1, "spread");
    const counts = new Array<number>(10).fill(0);
    for (let i = 0; i < 20_000; i++) counts[randomInt(random, 0, 9)] += 1;
    // 2,000 expected per digit; ±10% is far outside chance for this many draws
    for (const count of counts) expect(Math.abs(count - 2_000)).toBeLessThan(200);
    expect(randomDigits(random, 16)).toMatch(/^\d{16}$/);
    expect(randomDigits(random, 0)).toBe("");
  });

  it("stays within inclusive bounds", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: -50, max: 50 }), fc.integer({ min: 0, max: 50 }), (seed, min, span) => {
        const random = createRandom(seed, "bounds");
        for (let i = 0; i < 20; i++) {
          const n = randomInt(random, min, min + span);
          if (!Number.isInteger(n) || n < min || n > min + span) return false;
        }
        return true;
      }),
      RUNS,
    );
  });
});

describe("tcknCheckDigits and isValidTCKN", () => {
  it("matches the published example", () => {
    expect(tcknCheckDigits("100000001")).toBe("46");
  });

  it("agrees with the reference rule on any 11 digits", () => {
    const elevenDigits = fc.string({ unit: fc.constantFrom(..."0123456789".split("")), minLength: 11, maxLength: 11 });
    fc.assert(fc.property(elevenDigits, (value) => isValidTCKN(value) === referenceTCKN(value)), RUNS);
  });

  it("agrees with the reference rule on numbers built to be valid", () => {
    const nine = fc.tuple(fc.integer({ min: 1, max: 9 }), fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 8, maxLength: 8 }));
    fc.assert(
      fc.property(nine, ([first, rest]) => {
        const value = `${first}${rest.join("")}`;
        const tckn = value + tcknCheckDigits(value);
        return isValidTCKN(tckn) && referenceTCKN(tckn);
      }),
      RUNS,
    );
  });
});

describe("generateTCKN", () => {
  it("always passes isValidTCKN and the reference rule", () => {
    for (let i = 0; i < SAMPLES; i++) {
      const tckn = generateTCKN();
      expect(tckn).toMatch(/^[1-9]\d{10}$/);
      expect(isValidTCKN(tckn)).toBe(true);
      expect(referenceTCKN(tckn)).toBe(true);
    }
  });

  it("is valid and repeatable for any integer seed", () => {
    fc.assert(
      fc.property(fc.integer({ min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER }), (seed) => {
        const tckn = generateTCKN({ seed });
        return isValidTCKN(tckn) && generateTCKN({ seed }) === tckn;
      }),
      RUNS,
    );
  });

  it("keeps the same value for a seed across releases", () => {
    // Seeded output is a promise: snapshots in users' tests depend on it.
    expect(generateTCKN({ seed: 0 })).toBe("11353206292");
    expect(generateTCKN({ seed: 1 })).toBe("49537717654");
    expect(generateTCKN({ seed: 42 })).toBe("23534248168");
    expect(generateTCKN({ seed: -1 })).toBe("34630995368");
  });

  it("gives different numbers for different seeds", () => {
    const values = new Set(Array.from({ length: 1_000 }, (_, seed) => generateTCKN({ seed })));
    expect(values.size).toBeGreaterThan(995);
  });

  it("covers every first digit and every digit position", () => {
    const tckns = Array.from({ length: SAMPLES }, (_, seed) => generateTCKN({ seed }));
    expect(new Set(tckns.map((tckn) => tckn[0]))).toEqual(new Set("123456789"));
    for (let position = 1; position < 10; position++) {
      expect(new Set(tckns.map((tckn) => tckn[position])).size).toBe(10);
    }
    // the rule makes the last digit even, so only five values can appear there
    expect(new Set(tckns.map((tckn) => tckn[10]))).toEqual(new Set("02468"));
  });

  it("uses Math.random only without a seed", () => {
    const spy = vi.spyOn(Math, "random");
    generateTCKN({ seed: 3 });
    expect(spy).not.toHaveBeenCalled();
    generateTCKN();
    expect(spy).toHaveBeenCalled();
  });

  it("follows Math.random, so a mocked one gives a known number", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(generateTCKN()).toBe("10000000078");
    expect(isValidTCKN("10000000078")).toBe(true);
  });

  it("fits the tckn preset", () => {
    const mask = createMask("tckn");
    for (let seed = 0; seed < 200; seed++) {
      const tckn = generateTCKN({ seed });
      expect(mask.format(tckn)).toBe(tckn);
      expect(mask.parse(tckn)).toBe(tckn);
      expect(mask.validate(tckn)).toBeUndefined();
    }
  });

  it("rejects a seed that is not an integer", () => {
    expect(() => generateTCKN({ seed: 0.5 })).toThrow(TypeError);
  });
});

describe("mod97", () => {
  it("agrees with BigInt on any IBAN-like text", () => {
    const text = fc.string({ unit: fc.constantFrom(..."0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")), minLength: 1, maxLength: 34 });
    fc.assert(
      fc.property(text, (value) => {
        const numeric = [...value].map((char) => (/[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char)).join("");
        return mod97(value) === Number(BigInt(numeric) % 97n);
      }),
      RUNS,
    );
  });
});

describe("generateIBAN, Turkey", () => {
  it("defaults to a Turkish IBAN that every check accepts", () => {
    for (let i = 0; i < SAMPLES; i++) {
      const iban = generateIBAN();
      expect(iban).toMatch(/^TR\d{24}$/);
      expect(isValidIBAN(iban)).toBe(true);
      expect(referenceIBAN(iban)).toBe(true);
      expect(iban[9]).toBe("0"); // reserve digit after the five-digit bank code
      expect(getTurkishBank(iban)).not.toBeNull();
    }
  });

  it("builds an IBAN for every bank in turkishBanks", () => {
    for (const bank of turkishBanks) {
      for (let seed = 0; seed < 20; seed++) {
        const iban = generateIBAN("TR", { bank: bank.code, seed });
        expect(isValidIBAN(iban)).toBe(true);
        expect(iban.slice(4, 9)).toBe(`0${bank.code}`);
        expect(getTurkishBank(iban)).toEqual(bank);
      }
    }
  });

  it("picks banks across the whole list", () => {
    const codes = new Set(Array.from({ length: 5_000 }, (_, seed) => getTurkishBank(generateIBAN("TR", { seed }))?.code));
    expect(codes).toEqual(new Set(turkishBanks.map((bank) => bank.code)));
  });

  it("keeps the same value for a seed across releases", () => {
    expect(generateIBAN("TR", { seed: 0 })).toBe("TR600020509017201519401233");
    expect(generateIBAN("TR", { seed: 1 })).toBe("TR870013807238627956953482");
    expect(generateIBAN("TR", { seed: 42 })).toBe("TR580010802352036197943696");
    expect(generateIBAN("TR", { bank: "0062", seed: 1 })).toBe("TR510006205723862795695348");
  });

  it("gives unrelated digits for a TCKN and an IBAN with one seed", () => {
    const tckn = generateTCKN({ seed: 1 });
    expect(generateIBAN("TR", { seed: 1 })).not.toContain(tckn.slice(0, 6));
  });

  it("fits the Turkish iban preset", () => {
    const mask = createMask({ preset: "iban", country: "TR" });
    for (let seed = 0; seed < 200; seed++) {
      const iban = generateIBAN("TR", { seed });
      expect(mask.format(iban)).toMatch(/^TR\d{2}( \d{4}){5} \d{2}$/);
      expect(mask.parse(mask.format(iban))).toBe(iban);
      expect(mask.validate(iban)).toBeUndefined();
    }
  });

  it("rejects an unknown bank code", () => {
    expect(() => generateIBAN("TR", { bank: "9999" })).toThrow(RangeError);
    expect(() => generateIBAN("TR", { bank: "00062" })).toThrow(RangeError);
    expect(() => generateIBAN("TR", { bank: "62" })).toThrow(RangeError);
  });
});

describe("generateIBAN, other countries", () => {
  it("covers every country in the registry table", () => {
    for (const country of COUNTRIES) {
      for (let seed = 0; seed < 50; seed++) {
        const iban = generateIBAN(country, { seed });
        expect(iban).toHaveLength(IBAN_LENGTHS[country]);
        expect(iban.slice(0, 2)).toBe(country);
        expect(iban).toMatch(/^[A-Z]{2}\d+$/);
        expect(isValidIBAN(iban)).toBe(true);
        expect(referenceIBAN(iban)).toBe(true);
      }
    }
  });

  it("is valid and repeatable for any country and seed", () => {
    fc.assert(
      fc.property(fc.constantFrom(...COUNTRIES), fc.integer(), (country, seed) => {
        const iban = generateIBAN(country, { seed });
        return isValidIBAN(iban) && referenceIBAN(iban) && generateIBAN(country, { seed }) === iban;
      }),
      RUNS,
    );
  });

  it("uses every check digit pair from 02 to 98", () => {
    const checks = new Set(Array.from({ length: 5_000 }, (_, seed) => generateIBAN("DE", { seed }).slice(2, 4)));
    expect(checks.size).toBe(97);
    expect([...checks].every((check) => Number(check) >= 2 && Number(check) <= 98)).toBe(true);
  });

  it("gives different digits per country for one seed", () => {
    expect(generateIBAN("DE", { seed: 1 }).slice(4)).not.toBe(generateIBAN("AT", { seed: 1 }).slice(4, 22));
    expect(generateIBAN("DE", { seed: 1 })).toBe("DE70449725173128749365");
  });

  it("accepts lowercase country codes", () => {
    expect(generateIBAN("de", { seed: 1 })).toBe(generateIBAN("DE", { seed: 1 }));
  });

  it("fits the generic iban preset", () => {
    const mask = createMask("iban");
    for (const country of COUNTRIES) {
      const iban = generateIBAN(country, { seed: 5 });
      expect(mask.parse(mask.format(iban))).toBe(iban);
      expect(mask.validate(iban)).toBeUndefined();
    }
  });

  it("rejects countries outside the registry and a bank outside Turkey", () => {
    expect(() => generateIBAN("XX")).toThrow(RangeError);
    expect(() => generateIBAN("US")).toThrow(RangeError);
    expect(() => generateIBAN("")).toThrow(RangeError);
    expect(() => generateIBAN("DE", { bank: "0062" })).toThrow(TypeError);
  });

  it("uses Math.random only without a seed", () => {
    const spy = vi.spyOn(Math, "random");
    generateIBAN("DE", { seed: 3 });
    expect(spy).not.toHaveBeenCalled();
    generateIBAN("DE");
    expect(spy).toHaveBeenCalled();
  });
});
