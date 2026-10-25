import { describe, expect, it } from "vitest";
import { createMask, definePreset, getCardType, isValidIBAN, isValidTCKN, isValidVKN, toMinorUnits } from "../src/core";
import type { EditInput, Mask, MaskContext } from "../src/core";

/** Types `text` at the end of the current display, one character at a time. */
function type(mask: Mask, text: string, start = "", ctx?: MaskContext) {
  let display = start;
  let value = "";
  let cursor = display.length;
  for (const char of text) {
    const next = display.slice(0, cursor) + char + display.slice(cursor);
    const result = mask.edit({ previous: display, value: next, selectionStart: cursor + 1 }, ctx);
    ({ display, value, cursor } = result);
  }
  return { display, value, cursor };
}

function backspace(mask: Mask, display: string, caret = display.length, ctx?: MaskContext) {
  const input: EditInput = {
    previous: display,
    value: display.slice(0, caret - 1) + display.slice(caret),
    selectionStart: caret - 1,
    inputType: "deleteContentBackward",
  };
  return mask.edit(input, ctx);
}

describe("pattern engine", () => {
  it("formats and parses with literals", () => {
    const mask = createMask({ mask: "(999) 999-9999" });
    expect(mask.format("5551234567")).toBe("(555) 123-4567");
    expect(mask.parse("(555) 123-4567")).toBe("5551234567");
    expect(mask.format("555")).toBe("(555");
  });

  it("supports custom tokens and escapes", () => {
    const hex = createMask({ mask: "\\#hhhhhh", tokens: { h: /[0-9a-f]/i }, transform: "uppercase" });
    expect(hex.format("ff00aa")).toBe("#FF00AA");
    expect(hex.parse("#ff00zz")).toBe("FF00");
    const nine = createMask({ mask: "\\9-99" });
    expect(nine.format("12")).toBe("9-12");
  });

  it("handles optional sections", () => {
    const zip = createMask({ mask: "99999[-9999]" });
    expect(zip.format("12345")).toBe("12345");
    expect(zip.format("123456789")).toBe("12345-6789");
    expect(zip.isComplete("12345")).toBe(true);
    expect(zip.isComplete("1234")).toBe(false);
  });

  it("keeps fixed parts in the value", () => {
    const ibanTR = createMask({ preset: "iban", country: "TR" });
    expect(ibanTR.format("330006100519786457841326")).toBe("TR33 0006 1005 1978 6457 8413 26");
    expect(ibanTR.parse("TR33 0006 1005 1978 6457 8413 26")).toBe("TR330006100519786457841326");
    expect(ibanTR.format("TR330006100519786457841326")).toBe("TR33 0006 1005 1978 6457 8413 26");
  });

  it("picks the first fitting pattern from an array", () => {
    const mask = createMask({ mask: ["999-999", "9999-9999"] });
    expect(mask.format("123456")).toBe("123-456");
    expect(mask.format("1234567")).toBe("1234-567");
  });

  it("types, places the caret after literals and skips invalid characters", () => {
    const mask = createMask({ mask: "(999) 999-9999" });
    const result = type(mask, "555x1234567");
    expect(result.display).toBe("(555) 123-4567");
    expect(result.value).toBe("5551234567");
    expect(result.cursor).toBe(14);
  });

  it("deletes the digit before a separator on backspace", () => {
    const mask = createMask({ mask: "(999) 999-9999" });
    // caret after "(555) " — backspace removes the space, which should remove the 5 instead
    const result = backspace(mask, "(555) 123", 6);
    expect(result.display).toBe("(551) 23");
    expect(result.value).toBe("55123");
  });

  it("edits in the middle and keeps the caret", () => {
    const mask = createMask({ mask: "9999 9999" });
    const previous = "1234 5678";
    // insert "0" after "12"
    const result = mask.edit({ previous, value: "12034 5678", selectionStart: 3 });
    expect(result.display).toBe("1203 4567");
    expect(result.cursor).toBe(3);
  });

  it("parses a pasted, formatted value", () => {
    const mask = createMask({ preset: "phone", country: "TR" });
    const result = mask.edit({ previous: "", value: "+90 (555) 123 45 67", selectionStart: 19 });
    expect(result.value).toBe("5551234567");
    expect(result.display).toBe("(555) 123 45 67");
  });

  it("recovers when the DOM changed behind its back (autofill)", () => {
    const mask = createMask("card");
    const result = mask.edit({ previous: "4111", value: "4111111111111111", selectionStart: 16 });
    expect(result.display).toBe("4111 1111 1111 1111");
  });
});

describe("presets", () => {
  it("phone with country TR strips a leading 0 and the country code", () => {
    const mask = createMask({ preset: "phone", country: "TR" });
    expect(type(mask, "05551234567").value).toBe("5551234567");
    expect(mask.parse("+90 555 123 45 67")).toBe("5551234567");
    expect(mask.validate("555123")).toBe("phone.incomplete");
    expect(mask.validate("5551234567")).toBeUndefined();
  });

  it("phone is E.164 and switches to the Turkish layout on +90", () => {
    const mask = createMask("phone");
    expect(mask.format("+905551234567")).toBe("+90 (555) 123 45 67");
    expect(mask.parse("+90 (555) 123 45 67")).toBe("+905551234567");
    expect(mask.format("4915112345678")).toBe("+4915112345678");
    expect(mask.parse("0044 20 7946 0958")).toBe("+442079460958");
    expect(mask.validate("+90555")).toBe("phone.incomplete");
    expect(mask.validate("+442079460958")).toBeUndefined();
  });

  it("iban validates every country with mod-97", () => {
    const mask = createMask("iban");
    expect(mask.format("gb82west12345698765432")).toBe("GB82 WEST 1234 5698 7654 32");
    expect(mask.validate("GB82WEST12345698765432")).toBeUndefined();
    expect(mask.validate("GB82WEST12345698765433")).toBe("iban.invalid");
    expect(isValidIBAN("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(isValidIBAN("TR330006100519786457841326")).toBe(true);
    // the country code sets the length: a TR IBAN must have 26 characters
    expect(isValidIBAN("TR33000610051978645784132")).toBe(false);
  });

  it("card detects Amex and checks Luhn", () => {
    const mask = createMask("card");
    expect(mask.format("378282246310005")).toBe("3782 822463 10005");
    expect(mask.format("4111111111111111")).toBe("4111 1111 1111 1111");
    expect(mask.validate("4111111111111111")).toBeUndefined();
    expect(mask.validate("4111111111111112")).toBe("card.invalid");
    expect(mask.validate("4111")).toBe("card.incomplete");
    expect(getCardType("9792 0000")).toBe("troy");
    expect(getCardType("5555")).toBe("mastercard");
  });

  it("cvv follows the linked card", () => {
    const mask = createMask("cvv");
    expect(mask.format("1234", { from: "378282246310005" })).toBe("1234");
    expect(mask.format("1234", { from: "4111111111111111" })).toBe("123");
    expect(mask.format("1234")).toBe("123");
    expect(mask.usesFrom).toBe(true);
  });

  it("tckn and vkn", () => {
    expect(isValidTCKN("10000000146")).toBe(true);
    expect(isValidTCKN("12345678901")).toBe(false);
    expect(createMask("tckn").validate("12345678901")).toBe("tckn.invalid");
    expect(isValidVKN("1234567891")).toBe(false);
    expect(isValidVKN("1234567890")).toBe(true);
    expect(isValidVKN("0010010010")).toBe(true);
  });

  it("country variants keep the preset name in error keys", () => {
    expect(createMask({ preset: "phone", country: "TR" }).name).toBe("phone");
    expect(createMask({ preset: "iban", country: "TR" }).validate("TR330006100519786457841327")).toBe("iban.invalid");
    expect(createMask({ preset: "iban", country: "TR" }).format("GB82WEST")).toBe("TR82");
  });

  it("definePreset names error keys", () => {
    const plate = definePreset("plate", { mask: "99 a[aa] 99[99]", transform: "uppercase" });
    const mask = createMask(plate);
    expect(mask.format("34abc123")).toBe("34 ABC 123");
    expect(mask.validate("34")).toBe("plate.incomplete");
  });

  it("preset overrides compose validators", () => {
    const mask = createMask({ preset: "tckn", validate: (value) => value !== "10000000146" || "tckn.blocked" });
    expect(mask.validate("10000000146")).toBe("tckn.blocked");
    expect(mask.validate("12345678901")).toBe("tckn.invalid");
  });

  it("unknown presets fall back to plain text", () => {
    const mask = createMask("nope" as "phone");
    expect(mask.format("abc")).toBe("abc");
  });
});

describe("number and currency", () => {
  it("the global default has two decimals and no symbol", () => {
    const mask = createMask("currency");
    expect(mask.format("1234.56")).toBe("1,234.56");
    expect(mask.parse("1,234.56")).toBe("1234.56");
    expect(createMask("number").format("1234")).toBe("1,234");
  });

  it("country TR formats TRY with Intl and keeps kuruş", () => {
    const mask = createMask({ preset: "currency", country: "TR" });
    expect(mask.format("1234.56")).toBe("₺1.234,56");
    expect(mask.parse("₺1.234,56")).toBe("1234.56");
    expect(type(mask, "1234,56").display).toBe("₺1.234,56");
    expect(type(mask, "1234,56").value).toBe("1234.56");
  });

  it("accepts a typed dot as the decimal in tr-TR", () => {
    const mask = createMask({ preset: "currency", country: "TR" });
    expect(type(mask, "1234.5").value).toBe("1234.5");
  });

  it("switches currency from the linked field", () => {
    const mask = createMask("currency");
    expect(mask.format("1234.5", { from: "USD" })).toBe("$1,234.5");
    expect(mask.format("1234.5", { from: "EUR" })).toBe("€1,234.5");
    expect(mask.format("1234.5", { from: "TRY" })).toBe("₺1.234,5");
    // country TR keeps Turkish separators for any linked currency
    const tr = createMask({ preset: "currency", country: "TR" });
    expect(tr.format("1234.5", { from: "USD" })).toBe("$1.234,5");
  });

  it("country TR on number uses Turkish separators", () => {
    const mask = createMask({ preset: "number", country: "TR", number: { scale: 2 } });
    expect(mask.format("1234.5")).toBe("1.234,5");
    expect(mask.parse("1.234,5")).toBe("1234.5");
  });

  it("truncates to the currency scale", () => {
    const mask = createMask({ currency: "JPY" });
    expect(type(mask, "1234.56").value).toBe("123456");
    expect(type(createMask({ preset: "currency", country: "TR" }), "1,999").value).toBe("1.99");
  });

  it("number clamps max while typing and min on blur", () => {
    const mask = createMask({ number: { min: 10, max: 500 } });
    expect(type(mask, "999").value).toBe("500");
    expect(mask.finalize("5")).toBe("10");
    expect(mask.validate("5")).toBe("number.min");
  });

  it("backspace over a group separator removes the digit before it", () => {
    const mask = createMask({ preset: "number", country: "TR" });
    const result = backspace(mask, "1.234", 2);
    expect(result.display).toBe("234");
  });

  it("keeps a trailing decimal while typing", () => {
    const mask = createMask({ preset: "currency", country: "TR" });
    const result = type(mask, "12,");
    expect(result.display).toBe("₺12,");
    expect(result.value).toBe("12");
  });

  it("signed numbers", () => {
    const mask = createMask({ number: { signed: true, scale: 2, locale: "en-US" } });
    expect(type(mask, "-1234.5").display).toBe("-1,234.5");
    expect(mask.parse("-1,234.5")).toBe("-1234.5");
  });

  it("toMinorUnits avoids float errors", () => {
    expect(toMinorUnits("1234.56")).toBe(123456);
    expect(toMinorUnits("0.1", "TRY")).toBe(10);
    expect(toMinorUnits(19.99)).toBe(1999);
    expect(toMinorUnits("5", "JPY")).toBe(5);
    expect(toMinorUnits("-1.5")).toBe(-150);
    expect(toMinorUnits("abc")).toBeNaN();
  });
});

describe("date", () => {
  it("auto-corrects while typing", () => {
    const mask = createMask("date");
    expect(type(mask, "4").display).toBe("04/");
    expect(type(mask, "312").display).toBe("31/02/");
    expect(type(mask, "0113").display).toBe("01/1");
    expect(type(mask, "01022020").value).toBe("2020-02-01");
  });

  it("stores ISO and formats ISO", () => {
    const mask = createMask("date");
    expect(mask.format("2020-02-01")).toBe("01/02/2020");
    expect(mask.parse("01/02/2020")).toBe("2020-02-01");
    expect(mask.parse("2020-02-01")).toBe("2020-02-01");
    expect(mask.format(new Date(2020, 1, 1))).toBe("01/02/2020");
  });

  it("validates real dates, limits and minAge", () => {
    const mask = createMask({ date: { min: "2000-01-01", max: "2030-12-31" } });
    expect(mask.validate("2021-02-29")).toBe("date.invalid");
    expect(mask.validate("1999-12-31")).toBe("date.min");
    expect(mask.validate("2031-01-01")).toBe("date.max");
    expect(mask.validate("0102")).toBe("date.incomplete");
    const birth = createMask({ preset: "date", date: { max: "today", minAge: 18 } });
    expect(birth.validate("2020-01-01")).toBe("date.minAge");
    expect(birth.validate("1990-01-01")).toBeUndefined();
  });

  it("end date can't be before the linked start date", () => {
    const mask = createMask("date");
    expect(mask.validate("2026-01-01", { from: "2026-02-01" })).toBe("date.beforeFrom");
    expect(mask.validate("2026-03-01", { from: "2026-02-01" })).toBeUndefined();
  });

  it("expiry rejects past months", () => {
    const mask = createMask("expiry");
    expect(type(mask, "1").display).toBe("1");
    expect(type(mask, "2").display).toBe("02/");
    expect(mask.validate("0120")).toBe("expiry.min");
    expect(mask.validate("1299")).toBeUndefined();
    expect(mask.validate("13")).toBe("expiry.incomplete");
  });

  it("deleting an auto-inserted 0 does not get stuck (found by property tests)", () => {
    const mask = createMask("date");
    const result = mask.edit({ previous: "08/", value: "8/", selectionStart: 0, inputType: "deleteContentBackward" });
    expect(result.value).toBe("");
  });

  it("backspace after an eager separator removes the digit", () => {
    const mask = createMask("date");
    const result = backspace(mask, "04/");
    expect(result.display).toBe("0");
  });

  it("other formats", () => {
    expect(createMask({ date: { format: "YYYY-MM-DD" } }).format("2020-02-01")).toBe("2020-02-01");
    expect(createMask({ date: { format: "MM/DD/YYYY" } }).format("2020-02-01")).toBe("02/01/2020");
    expect(createMask({ date: { format: "DD.MM.YYYY" } }).parse("01.02.2020")).toBe("2020-02-01");
  });
});
