// Property-based tests: random input and random edit sequences instead of hand-picked examples.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createMask, toMinorUnits, type Mask, type MaskContext, type MaskSpec } from "../src/core";

const RUNS = { numRuns: Number(process.env.FC_RUNS ?? 300) };

const specs: Record<string, MaskSpec> = {
  card: "card",
  phone: "phone",
  phoneTR: { preset: "phone", country: "TR" },
  iban: "iban",
  ibanTR: { preset: "iban", country: "TR" },
  tckn: "tckn",
  expiry: "expiry",
  date: "date",
  dateUS: { date: { format: "MM/DD/YYYY" } },
  dateISO: { date: { format: "YYYY-MM-DD" } },
  currency: "currency",
  currencyTR: { preset: "currency", country: "TR" },
  numberTR: { preset: "number", country: "TR", number: { scale: 2, signed: true } },
  currencyUSD: { currency: "USD" },
  number: { number: { signed: true, scale: 2, min: -5000, max: 5000 } },
  optional: { mask: "99999[-9999]" },
  fixed: { mask: "{+}99 (999) 999 99 99" },
  escaped: { mask: "\\#hhhhhh", tokens: { h: /[0-9a-f]/i }, transform: "uppercase" },
  plate: { mask: "99 a[aa] 99[99]", transform: "uppercase" },
  dynamic: { mask: ["999-999", "9999-9999"] },
};

/** Text a user might type or paste: digits, letters (incl. Turkish), separators and symbols. */
const anyText = fc.string({
  unit: fc.constantFrom(..."0123456789aAzZçÇğıİöşü +-().,/₺$€#TRtr\t".split("")),
  maxLength: 40,
});

type Op =
  | { type: "insert"; at: number; text: string }
  | { type: "backspace"; at: number }
  | { type: "delete"; at: number }
  | { type: "replace"; from: number; to: number; text: string };

const op: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ type: fc.constant("insert" as const), at: fc.nat(), text: anyText.filter((t) => t.length > 0) }),
  fc.record({ type: fc.constant("backspace" as const), at: fc.nat() }),
  fc.record({ type: fc.constant("delete" as const), at: fc.nat() }),
  fc.record({ type: fc.constant("replace" as const), from: fc.nat(), to: fc.nat(), text: anyText }),
);

/** Applies one edit the way a browser would and returns the event the mask receives. */
function browserEdit(display: string, edit: Op) {
  const clamp = (n: number) => Math.min(n, display.length);
  switch (edit.type) {
    case "insert": {
      const at = clamp(edit.at);
      return {
        value: display.slice(0, at) + edit.text + display.slice(at),
        selectionStart: at + edit.text.length,
        inputType: edit.text.length > 1 ? "insertFromPaste" : "insertText",
      };
    }
    case "backspace": {
      const at = clamp(edit.at);
      if (at === 0) return undefined;
      return { value: display.slice(0, at - 1) + display.slice(at), selectionStart: at - 1, inputType: "deleteContentBackward" };
    }
    case "delete": {
      const at = clamp(edit.at);
      if (at >= display.length) return undefined;
      return { value: display.slice(0, at) + display.slice(at + 1), selectionStart: at, inputType: "deleteContentForward" };
    }
    case "replace": {
      const from = clamp(Math.min(edit.from, edit.to));
      const to = clamp(Math.max(edit.from, edit.to));
      return {
        value: display.slice(0, from) + edit.text + display.slice(to),
        selectionStart: from + edit.text.length,
        inputType: "insertReplacementText",
      };
    }
  }
}

function contextFor(name: string): MaskContext {
  return name === "currencyUSD" ? {} : {};
}

describe.each(Object.entries(specs))("%s", (name, spec) => {
  const mask: Mask = createMask(spec);
  const ctx = contextFor(name);

  it("format and parse agree for any text", () => {
    fc.assert(
      fc.property(anyText, (text) => {
        const value = mask.parse(text, ctx);
        // The parsed value is stable: parsing its own display gives it back.
        expect(mask.parse(mask.format(value, ctx), ctx)).toBe(value);
        // Formatting is idempotent.
        const display = mask.format(value, ctx);
        expect(mask.format(mask.parse(display, ctx), ctx)).toBe(display);
      }),
      RUNS,
    );
  });

  it("any edit sequence keeps display, value and caret consistent", () => {
    fc.assert(
      fc.property(fc.array(op, { maxLength: 25 }), (ops) => {
        let display = "";
        for (const edit of ops) {
          const event = browserEdit(display, edit);
          if (!event) continue;
          const result = mask.edit({ previous: display, ...event }, ctx);

          expect(result.cursor).toBeGreaterThanOrEqual(0);
          expect(result.cursor).toBeLessThanOrEqual(result.display.length);
          expect(mask.parse(result.display, ctx)).toBe(result.value);
          expect(result.complete).toBe(mask.isComplete(result.value, ctx));
          if (mask.kind !== "number" && mask.kind !== "currency") {
            // Number masks may show a trailing separator while typing ("12,"); patterns never differ.
            expect(result.display).toBe(mask.format(result.value, ctx));
          }

          // A no-op event changes nothing.
          const again = mask.edit({ previous: result.display, value: result.display, selectionStart: result.cursor }, ctx);
          expect(again.display).toBe(result.display);
          expect(again.value).toBe(result.value);

          display = result.display;
        }
      }),
      RUNS,
    );
  });

  it("backspace at the end never gets stuck", () => {
    fc.assert(
      fc.property(anyText, (text) => {
        let display = mask.format(mask.parse(text, ctx), ctx);
        let steps = 0;
        while (display !== "" && mask.parse(display, ctx) !== "") {
          const before = mask.parse(display, ctx);
          const result = mask.edit(
            {
              previous: display,
              value: display.slice(0, -1),
              selectionStart: display.length - 1,
              inputType: "deleteContentBackward",
            },
            ctx,
          );
          expect(result.value.length).toBeLessThan(before.length + 1);
          expect(result.value === before && result.display === display).toBe(false);
          display = result.display;
          if (++steps > 200) throw new Error("backspace loop");
        }
      }),
      RUNS,
    );
  });

  it("backspace anywhere deletes something when a value character is before the caret", () => {
    fc.assert(
      fc.property(anyText, fc.nat(), (text, at) => {
        const display = mask.format(mask.parse(text, ctx), ctx);
        const caret = Math.min(at, display.length);
        if (caret === 0 || mask.parse(display.slice(0, caret), ctx) === "") return;
        // A lone integer zero before a fraction ("₺0,5") is kept on purpose.
        if ((mask.kind === "number" || mask.kind === "currency") && /^-?0\./.test(mask.parse(display, ctx))) return;
        const result = mask.edit(
          {
            previous: display,
            value: display.slice(0, caret - 1) + display.slice(caret),
            selectionStart: caret - 1,
            inputType: "deleteContentBackward",
          },
          ctx,
        );
        expect(result.value).not.toBe(mask.parse(display, ctx));
      }),
      RUNS,
    );
  });

  it("typing a value one character at a time equals formatting it", () => {
    fc.assert(
      fc.property(anyText, (text) => {
        const value = mask.parse(text, ctx);
        if (mask.kind === "number" || mask.kind === "currency" || mask.kind === "date") return;
        let display = "";
        for (const char of value) {
          const result = mask.edit(
            { previous: display, value: display + char, selectionStart: display.length + 1, inputType: "insertText" },
            ctx,
          );
          display = result.display;
        }
        expect(mask.parse(display, ctx)).toBe(value);
      }),
      RUNS,
    );
  });
});

describe("number properties", () => {
  it("any decimal within the scale round-trips", () => {
    const mask = createMask({ number: { signed: true, scale: 2, locale: "tr-TR" } });
    fc.assert(
      fc.property(fc.integer({ min: -1e12, max: 1e12 }), fc.integer({ min: 0, max: 99 }), (int, cents) => {
        const value = `${int}.${String(cents).padStart(2, "0")}`.replace(/^(-?)0+(?=\d)/, "$1");
        const canonical = value.replace(/\.?0+$/, "").replace(/^-0$/, "0") || "0";
        const parsed = mask.parse(mask.format(value));
        expect(Number(parsed)).toBe(Number(canonical));
      }),
      RUNS,
    );
  });

  it("toMinorUnits matches integer math", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1e13 }), fc.integer({ min: 0, max: 99 }), (int, cents) => {
        const text = `${int}.${String(cents).padStart(2, "0")}`;
        expect(toMinorUnits(text, 2)).toBe(int * 100 + cents);
      }),
      RUNS,
    );
  });

  it("max is never exceeded while typing", () => {
    const mask = createMask({ number: { max: 500 } });
    fc.assert(
      fc.property(fc.array(op, { maxLength: 20 }), (ops) => {
        let display = "";
        for (const edit of ops) {
          const event = browserEdit(display, edit);
          if (!event) continue;
          const result = mask.edit({ previous: display, ...event });
          if (result.value !== "") expect(Number(result.value)).toBeLessThanOrEqual(500);
          display = result.display;
        }
      }),
      RUNS,
    );
  });
});

describe("date properties", () => {
  const isoDate = fc
    .date({ min: new Date(1900, 0, 1), max: new Date(2099, 11, 31), noInvalidDate: true })
    .map((d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);

  it.each(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD.MM.YYYY"] as const)("%s round-trips ISO dates", (format) => {
    const mask = createMask({ date: { format } });
    fc.assert(
      fc.property(isoDate, (iso) => {
        expect(mask.parse(mask.format(iso))).toBe(iso);
        expect(mask.validate(iso)).toBeUndefined();
      }),
      RUNS,
    );
  });

  it("typed digits never produce a month above 12 or a day above 31", () => {
    const mask = createMask("date");
    fc.assert(
      fc.property(fc.string({ unit: fc.constantFrom(..."0123456789".split("")), maxLength: 12 }), (digits) => {
        let display = "";
        for (const char of digits) {
          display = mask.edit({ previous: display, value: display + char, selectionStart: display.length + 1 }).display;
        }
        const [day, month] = display.split("/");
        if (day?.length === 2) expect(Number(day)).toBeGreaterThanOrEqual(1);
        if (day?.length === 2) expect(Number(day)).toBeLessThanOrEqual(31);
        if (month?.length === 2) expect(Number(month)).toBeGreaterThanOrEqual(1);
        if (month?.length === 2) expect(Number(month)).toBeLessThanOrEqual(12);
      }),
      RUNS,
    );
  });
});
