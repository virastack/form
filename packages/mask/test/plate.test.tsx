import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import fc from "fast-check";
import { useForm, type UseFormReturn } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { createMask, isValidPlate, presets, useViraMask } from "../src";
import type { EditInput, Mask } from "../src/core";
import * as server from "../src/server";

// Article 34/1 of the Araçların Satış, Devir ve Tescil Hizmetlerinin Yürütülmesi Hakkında Yönetmelik:
// after the province code, letter count → allowed digit counts.
const GROUPS: Record<number, readonly number[]> = { 1: [4, 5], 2: [3, 4], 3: [2, 3] };
const LATIN = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Reference rule, written apart from the implementation. */
function reference(value: string): boolean {
  const compact = value.replace(/[\s-]/g, "").replace(/[iıİ]/g, "I").toUpperCase();
  const province = Number(compact.slice(0, 2));
  if (!/^\d{2}$/.test(compact.slice(0, 2)) || province < 1 || province > 81) return false;
  const rest = compact.slice(2);
  const letters = /^[A-Z]*/.exec(rest)?.[0] ?? "";
  const digits = rest.slice(letters.length);
  if (!/^\d+$/.test(digits)) return false;
  return (GROUPS[letters.length] ?? []).includes(digits.length);
}

const province = (n: number) => String(n).padStart(2, "0");

/** Types `text` at the end of the current display, one character at a time. */
function type(mask: Mask, text: string) {
  let display = "";
  let value = "";
  let cursor = 0;
  for (const char of text) {
    const next = display.slice(0, cursor) + char + display.slice(cursor);
    ({ display, value, cursor } = mask.edit({ previous: display, value: next, selectionStart: cursor + 1 }));
  }
  return { display, value, cursor };
}

function backspace(mask: Mask, display: string) {
  const caret = display.length;
  const input: EditInput = {
    previous: display,
    value: display.slice(0, caret - 1),
    selectionStart: caret - 1,
    inputType: "deleteContentBackward",
  };
  return mask.edit(input);
}

describe("isValidPlate", () => {
  it.each([
    ["34A1234", "1 letter + 4 digits"],
    ["34A12345", "1 letter + 5 digits"],
    ["34AB123", "2 letters + 3 digits"],
    ["34AB1234", "2 letters + 4 digits"],
    ["34ABC12", "3 letters + 2 digits"],
    ["34ABC123", "3 letters + 3 digits"],
  ])("accepts %s (%s)", (plate) => {
    expect(isValidPlate(plate)).toBe(true);
  });

  it.each([
    ["34A123", "1 letter + 3 digits"],
    ["34A123456", "1 letter + 6 digits"],
    ["34AB12", "2 letters + 2 digits"],
    ["34AB12345", "2 letters + 5 digits"],
    ["34ABC1", "3 letters + 1 digit"],
    ["34ABC1234", "3 letters + 4 digits"],
    ["34ABCD12", "4 letters"],
    ["341234", "no letters"],
    ["34ABC", "no digits"],
  ])("rejects %s (%s)", (plate) => {
    expect(isValidPlate(plate)).toBe(false);
  });

  it("accepts every province code from 01 to 81 with every group", () => {
    for (let n = 1; n <= 81; n++) {
      for (const [letters, counts] of Object.entries(GROUPS)) {
        for (const count of counts) {
          const plate = `${province(n)}${"K".repeat(Number(letters))}${"7".repeat(count)}`;
          expect(isValidPlate(plate), plate).toBe(true);
        }
      }
    }
  });

  it.each(["00AB123", "82AB123", "99AB123", "1AB123", "034AB123", "AB123", "3AAB123"])("rejects province code in %s", (plate) => {
    expect(isValidPlate(plate)).toBe(false);
  });

  it("ignores spaces and hyphens, wherever they are", () => {
    expect(isValidPlate("34 AB1 23")).toBe(true);
    expect(isValidPlate("3-4AB-123")).toBe(true);
  });

  it("accepts the display format, hyphens and lowercase", () => {
    expect(isValidPlate("34 ABC 123")).toBe(true);
    expect(isValidPlate("34-abc-123")).toBe(true);
    expect(isValidPlate(" 06  a 1234 ")).toBe(true);
    expect(isValidPlate("34\tAB\n123")).toBe(true);
  });

  it("reads the Turkish i, ı and İ as I", () => {
    expect(isValidPlate("34 ı 1234")).toBe(true);
    expect(isValidPlate("34 i 1234")).toBe(true);
    expect(isValidPlate("34 İ 1234")).toBe(true);
    expect(isValidPlate("34 kıl 12")).toBe(true);
  });

  it.each(["Ç", "Ğ", "Ö", "Ş", "Ü", "Ä", "Ж", "Ω"])("rejects letters outside the Latin alphabet: %s", (letter) => {
    expect(isValidPlate(`34 ${letter} 1234`)).toBe(false);
    expect(isValidPlate(`34 A${letter} 123`)).toBe(false);
  });

  it("accepts every Latin letter, Q, W and X included: the regulation excludes none", () => {
    for (const letter of LATIN) expect(isValidPlate(`34 ${letter} 1234`), letter).toBe(true);
    expect(isValidPlate("34 QWX 12")).toBe(true);
  });

  it.each([
    ["06 A 1234", "makam and police, A"],
    ["06 AA 123", "makam and police, AA"],
    ["06 AAA 12", "makam and police, AAA"],
    ["06 CD 1234", "embassy, CD"],
    ["06 CC 123", "consulate, CC"],
    ["06 CG 123", "consulate, CG"],
    ["06 CM 123", "international organisation, CM"],
    ["34 MA 1234", "foreign residents, MA"],
    ["34 MZ 123", "foreign residents, MZ"],
    ["34 T 12345", "temporary, prototype or road test"],
    ["34 G 12345", "temporary"],
    ["34 GMR 123", "temporary customs"],
    ["06 JAA 123", "gendarmerie, first group"],
    ["06 JZZ 123", "gendarmerie, last group"],
    ["34 SGH 123", "coast guard"],
  ])("accepts the article 34/3 series %s (%s)", (plate) => {
    expect(isValidPlate(plate)).toBe(true);
  });

  it("does not check name plates (article 37) or special plates (article 36)", () => {
    expect(isValidPlate("34 OMER 1")).toBe(false);
    expect(isValidPlate("34 VIRASTACK 1")).toBe(false);
    expect(isValidPlate("CB 123")).toBe(false);
  });

  it.each(["", " ", "34", "34 ABC", "34 ABC 123 4", "34 1AB 23", "34_AB_123", "34.AB.123", "３４AB123"])(
    "rejects malformed input %j",
    (plate) => {
      expect(isValidPlate(plate)).toBe(false);
    },
  );

  it("matches the reference rule on generated valid plates", () => {
    const valid = fc
      .tuple(
        fc.integer({ min: 1, max: 81 }),
        fc.constantFrom(1, 2, 3),
        fc.array(fc.constantFrom(...LATIN), { minLength: 3, maxLength: 3 }),
        fc.boolean(),
        fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 5, maxLength: 5 }),
      )
      .map(([code, letters, chars, longer, numbers]) => {
        const count = GROUPS[letters][longer ? 1 : 0];
        return `${province(code)}${chars.slice(0, letters).join("")}${numbers.slice(0, count).join("")}`;
      });
    fc.assert(
      fc.property(valid, (plate) => {
        expect(isValidPlate(plate)).toBe(true);
        expect(reference(plate)).toBe(true);
      }),
      { numRuns: 2000 },
    );
  });

  it("matches the reference rule on near-miss and random input", () => {
    const nearMiss = fc
      .tuple(
        fc.integer({ min: 0, max: 99 }),
        fc.array(fc.constantFrom(..."ABCÇİIıiXYZ"), { maxLength: 5 }),
        fc.array(fc.integer({ min: 0, max: 9 }), { maxLength: 7 }),
        fc.constantFrom("", " ", "-"),
      )
      .map(([code, letters, numbers, sep]) => [province(code), letters.join(""), numbers.join("")].join(sep));
    fc.assert(
      fc.property(fc.oneof(nearMiss, fc.string({ maxLength: 12 })), (plate) => {
        expect(isValidPlate(plate)).toBe(reference(plate));
      }),
      { numRuns: 5000 },
    );
  });
});

describe("plate preset", () => {
  const mask = createMask("plate");

  it("is a built-in preset with text input", () => {
    expect(presets.plate.name).toBe("plate");
    expect(mask.inputProps).toMatchObject({ inputMode: "text", autoComplete: "off" });
  });

  it.each([
    ["34abc123", "34 ABC 123", "34ABC123"],
    ["34 abc 12", "34 ABC 12", "34ABC12"],
    ["06a1234", "06 A 1234", "06A1234"],
    ["06a12345", "06 A 12345", "06A12345"],
    ["35ab123", "35 AB 123", "35AB123"],
    ["35-ab-1234", "35 AB 1234", "35AB1234"],
    ["06 ı 1234", "06 I 1234", "06I1234"],
    ["34 kıl 12", "34 KIL 12", "34KIL12"],
  ])("formats %s as %s and stores %s", (input, display, value) => {
    expect(mask.format(input)).toBe(display);
    expect(mask.parse(input)).toBe(value);
    expect(mask.format(mask.parse(input))).toBe(display);
    expect(mask.validate(value)).toBeUndefined();
  });

  it("keeps the digit count of the letter group: extra digits are dropped", () => {
    expect(mask.parse("34A123456")).toBe("34A12345");
    expect(mask.parse("34AB12345")).toBe("34AB1234");
    expect(mask.parse("34ABC1234")).toBe("34ABC123");
  });

  it("keeps at most three letters", () => {
    expect(mask.parse("34ABCD123")).toBe("34ABC123");
  });

  it("drops letters outside the Latin alphabet", () => {
    expect(mask.parse("34 ÇAB 123")).toBe("34AB123");
    // The letter group is required, so digits typed in its place wait for a letter.
    expect(mask.parse("34Ş1234")).toBe("34");
  });

  it("is incomplete until the group has its minimum digits", () => {
    expect(mask.validate("34")).toBe("plate.incomplete");
    expect(mask.validate("34A")).toBe("plate.incomplete");
    expect(mask.validate("34A123")).toBe("plate.incomplete");
    expect(mask.validate("34AB12")).toBe("plate.incomplete");
    expect(mask.validate("34ABC1")).toBe("plate.incomplete");
    expect(mask.isComplete("34A1234")).toBe(true);
    expect(mask.isComplete("34AB123")).toBe(true);
    expect(mask.isComplete("34ABC12")).toBe(true);
  });

  it("reports an unknown province code as invalid", () => {
    expect(mask.validate("00AB123")).toBe("plate.invalid");
    expect(mask.validate("82AB123")).toBe("plate.invalid");
    expect(mask.validate("81AB123")).toBeUndefined();
    expect(mask.validate("01AB123")).toBeUndefined();
  });

  it("an empty value has no error, so required stays the form's job", () => {
    expect(mask.validate("")).toBeUndefined();
  });

  it("types character by character", () => {
    expect(type(mask, "34abc123")).toMatchObject({ display: "34 ABC 123", value: "34ABC123", cursor: 10 });
    expect(type(mask, "06a12345")).toMatchObject({ display: "06 A 12345", value: "06A12345" });
    expect(type(mask, "06a123456").value).toBe("06A12345");
    expect(type(mask, "34 ab 1234")).toMatchObject({ display: "34 AB 1234", value: "34AB1234" });
  });

  it("lets the letter group grow until a digit is typed", () => {
    expect(type(mask, "34a").display).toBe("34 A");
    expect(type(mask, "34ab").display).toBe("34 AB");
    expect(type(mask, "34abc").display).toBe("34 ABC");
    expect(type(mask, "34abcd").display).toBe("34 ABC");
  });

  it("deletes back through the groups", () => {
    let display = "34 AB 123";
    const values: string[] = [];
    while (display) {
      const result = backspace(mask, display);
      display = result.display;
      values.push(result.value);
    }
    expect(values).toEqual(["34AB12", "34AB1", "34AB", "34A", "34", "3", ""]);
  });

  it("every valid plate round-trips through format and parse", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 81 }),
        fc.constantFrom(1, 2, 3),
        fc.boolean(),
        fc.stringMatching(/^[A-Z]{3}$/),
        fc.stringMatching(/^\d{5}$/),
        (code, letters, longer, chars, numbers) => {
          const value = `${province(code)}${chars.slice(0, letters)}${numbers.slice(0, GROUPS[letters][longer ? 1 : 0])}`;
          expect(mask.parse(mask.format(value))).toBe(value);
          expect(mask.validate(value)).toBeUndefined();
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("is exported from /server with the same rules", () => {
    expect(server.isValidPlate("34 ABC 123")).toBe(true);
    expect(server.createMask("plate").format("34abc123")).toBe("34 ABC 123");
  });

  it("parseMasked checks it on the server", async () => {
    const form = new FormData();
    form.set("plate", "34 abc 123");
    const ok = await server.parseMasked({ plate: "plate" }, form);
    expect(ok).toEqual({ success: true, data: { plate: "34ABC123" } });
    form.set("plate", "82 AB 123");
    const bad = await server.parseMasked({ plate: "plate" }, form);
    expect(bad.success).toBe(false);
    expect(bad.errors).toEqual({ plate: "plate.invalid" });
  });
});

describe("plate in useViraMask", () => {
  let form!: UseFormReturn<{ plate: string }>;

  function PlateField() {
    form = useForm<{ plate: string }>({ defaultValues: { plate: "" } });
    const { plate } = useViraMask(form, { plate: "plate" });
    return <input aria-label="Plate" {...plate} />;
  }

  it("shows the spaced plate and keeps the compact value in the form", async () => {
    render(<PlateField />);
    const input = screen.getByLabelText("Plate") as HTMLInputElement;
    await userEvent.type(input, "34abc123");
    expect(input.value).toBe("34 ABC 123");
    expect(form.getValues("plate")).toBe("34ABC123");
  });

  it("validates on submit", async () => {
    render(<PlateField />);
    const input = screen.getByLabelText("Plate") as HTMLInputElement;
    await userEvent.type(input, "82ab123");
    expect(await form.trigger("plate")).toBe(false);
    expect(form.getFieldState("plate").error?.message).toBe("plate.invalid");
    await userEvent.clear(input);
    await userEvent.type(input, "34ab12");
    expect(await form.trigger("plate")).toBe(false);
    expect(form.getFieldState("plate").error?.message).toBe("plate.incomplete");
  });
});
