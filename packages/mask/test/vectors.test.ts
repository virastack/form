// Known-good identifiers from public registries, plus generated ones checked against independent implementations.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createMask, isValidCard, isValidIBAN, isValidLuhn, isValidTCKN, isValidVKN } from "../src/core";

/** Example IBANs published in the SWIFT IBAN registry, one per country. */
const IBANS = [
  "AL47212110090000000235698741", "AD1200012030200359100100", "AT611904300234573201",
  "AZ21NABZ00000000137010001944", "BH67BMAG00001299123456", "BE68539007547034",
  "BA391290079401028494", "BR1800360305000010009795493C1", "BG80BNBG96611020345678",
  "CR05015202001026284066", "HR1210010051863000160", "CY17002001280000001200527600",
  "CZ6508000000192000145399", "DK5000400440116243", "DO28BAGR00000001212453611324",
  "EE382200221020145685", "FO6264600001631634", "FI2112345600000785",
  "FR1420041010050500013M02606", "GE29NB0000000101904917", "DE89370400440532013000",
  "GI75NWBK000000007099453", "GR1601101250000000012300695", "GL8964710001000206",
  "GT82TRAJ01020000001210029690", "HU42117730161111101800000000", "IS140159260076545510730339",
  "IE29AIBK93115212345678", "IL620108000000099999999", "IT60X0542811101000000123456",
  "JO94CBJO0010000000000131000302", "KZ86125KZT5004100100", "XK051212012345678906",
  "KW81CBKU0000000000001234560101", "LV80BANK0000435195001", "LB62099900000001001901229114",
  "LI21088100002324013AA", "LT121000011101001000", "LU280019400644750000",
  "MT84MALT011000012345MTLCAST001S", "MR1300020001010000123456753", "MU17BOMM0101101030300200000MUR",
  "MD24AG000225100013104168", "MC5811222000010123456789030", "ME25505000012345678951",
  "NL91ABNA0417164300", "MK07250120000058984", "NO9386011117947",
  "PK36SCBL0000001123456702", "PS92PALS000000000400123456702", "PL61109010140000071219812874",
  "PT50000201231234567890154", "QA58DOHB00001234567890ABCDEFG", "RO49AAAA1B31007593840000",
  "SM86U0322509800000000270100", "SA0380000000608010167519", "RS35260005601001611379",
  "SK3112000000198742637541", "SI56263300012039086", "ES9121000418450200051332",
  "SE4550000000058398257466", "CH9300762011623852957", "TN5910006035183598478831",
  "TR330006100519786457841326", "AE070331234567890123456", "GB29NWBK60161331926819",
  "VG96VPVG0000012345678901",
];

/** Independent mod-97 check digit calculation (ISO 7064). */
function withCheckDigits(country: string, bban: string): string {
  const numeric = [...`${bban}${country}00`].map((c) => (/\d/.test(c) ? c : String(c.charCodeAt(0) - 55))).join("");
  const check = 98 - Number(BigInt(numeric) % 97n);
  return `${country}${String(check).padStart(2, "0")}${bban}`;
}

/** Test card numbers published by payment providers. */
const CARDS = [
  "4111111111111111", "4012888888881881", "4242424242424242", "5555555555554444",
  "5105105105105100", "2223003122003222", "378282246310005", "371449635398431",
];

describe("IBAN registry examples", () => {
  it.each(IBANS)("%s is valid and round-trips the iban mask", (iban) => {
    expect(isValidIBAN(iban)).toBe(true);
    const mask = createMask("iban");
    expect(mask.validate(iban)).toBeUndefined();
    expect(mask.parse(mask.format(iban))).toBe(iban);
    expect(mask.format(iban).replace(/ /g, "")).toBe(iban);
  });

  it.each(IBANS)("%s fails after any single character changes", (iban) => {
    for (let i = 0; i < iban.length; i++) {
      const char = iban[i];
      const replacement = /\d/.test(char) ? String((Number(char) + 1) % 10) : char === "Z" ? "A" : String.fromCharCode(char.charCodeAt(0) + 1);
      expect(isValidIBAN(iban.slice(0, i) + replacement + iban.slice(i + 1))).toBe(false);
    }
  });

  it("a wrong length for the country fails even with a valid checksum", () => {
    // Recompute the check digits after adding or removing a character, so only the length is wrong.
    for (const iban of IBANS) {
      for (const body of [iban.slice(4) + "0", iban.slice(4, -1)]) {
        const candidate = withCheckDigits(iban.slice(0, 2), body);
        if (candidate.length < 15) continue;
        expect(isValidIBAN(candidate)).toBe(false);
      }
    }
  });

  it("unknown countries fall back to the generic rule", () => {
    expect(isValidIBAN(withCheckDigits("ZZ", "1234567890123"))).toBe(true);
  });
});

describe("card numbers", () => {
  it.each(CARDS)("%s passes Luhn and the card mask", (card) => {
    expect(isValidCard(card)).toBe(true);
    expect(createMask("card").validate(card)).toBeUndefined();
  });

  it("a Troy number with a computed check digit is valid", () => {
    const troy = `979200000000000${luhnCheckDigit("979200000000000")}`;
    expect(isValidCard(troy)).toBe(true);
  });

  it("Luhn catches every single-digit error", () => {
    fc.assert(
      fc.property(fc.string({ unit: fc.constantFrom(..."0123456789"), minLength: 15, maxLength: 15 }), fc.nat(15), fc.integer({ min: 1, max: 9 }), (body, at, delta) => {
        const card = body + luhnCheckDigit(body);
        expect(isValidLuhn(card)).toBe(true);
        const digit = (Number(card[at]) + delta) % 10;
        expect(isValidLuhn(card.slice(0, at) + digit + card.slice(at + 1))).toBe(false);
      }),
    );
  });
});

/** Independent Luhn check digit (doubling from the right, written differently from the source). */
function luhnCheckDigit(body: string): string {
  const sum = [...body]
    .reverse()
    .map(Number)
    .reduce((acc, digit, index) => acc + (index % 2 === 0 ? [0, 2, 4, 6, 8, 1, 3, 5, 7, 9][digit] : digit), 0);
  return String((10 - (sum % 10)) % 10);
}

/** Independent TCKN generator following the published rule. */
function tcknFromNine(nine: string): string {
  const d = [...nine].map(Number);
  const tenth = (((d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7])) % 10 + 10) % 10;
  const eleventh = (d.reduce((a, b) => a + b, 0) + tenth) % 10;
  return `${nine}${tenth}${eleventh}`;
}

/** Independent VKN check digit following the GİB description. */
function vknCheckDigit(nine: string): string {
  let sum = 0;
  for (let i = 1; i <= 9; i++) {
    const tmp = (Number(nine[i - 1]) + 10 - i) % 10;
    sum += tmp === 9 ? 9 : (tmp * 2 ** (10 - i)) % 9;
  }
  return String((10 - (sum % 10)) % 10);
}

const nineDigits = fc.string({ unit: fc.constantFrom(..."0123456789"), minLength: 9, maxLength: 9 });

describe("TCKN", () => {
  it.each(["10000000146", "11111111110", "12345678950"])("%s is valid", (tckn) => {
    expect(isValidTCKN(tckn)).toBe(true);
  });

  it.each(["12345678901", "00000000000", "11111111111", "1234567890", "1000000014a", "01234567890"])("%s is invalid", (tckn) => {
    expect(isValidTCKN(tckn)).toBe(false);
  });

  it("agrees with an independent implementation and catches single-digit errors", () => {
    fc.assert(
      fc.property(nineDigits.filter((s) => s[0] !== "0"), fc.nat(10), fc.integer({ min: 1, max: 9 }), (nine, at, delta) => {
        const tckn = tcknFromNine(nine);
        expect(isValidTCKN(tckn)).toBe(true);
        const mutated = tckn.slice(0, at) + ((Number(tckn[at]) + delta) % 10) + tckn.slice(at + 1);
        expect(isValidTCKN(mutated)).toBe(false);
      }),
    );
  });
});

describe("VKN", () => {
  it("agrees with an independent implementation on every 9-digit body", () => {
    fc.assert(
      fc.property(nineDigits, fc.integer({ min: 0, max: 9 }), (nine, last) => {
        const expected = vknCheckDigit(nine) === String(last);
        expect(isValidVKN(`${nine}${last}`)).toBe(expected);
      }),
      { numRuns: 2000 },
    );
  });

  it.each(["123456789", "12345678901", "abcdefghij", ""])("%s is invalid", (vkn) => {
    expect(isValidVKN(vkn)).toBe(false);
  });
});
