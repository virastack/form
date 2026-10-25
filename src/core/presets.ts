import type { MaskKind, MaskOptions, Preset } from "./types";
import { getCardType, isValidIBAN, isValidIBANTR, isValidLuhn, isValidTCKN, isValidVKN } from "./validators";

export type KindOfOptions<O> = O extends { mask: unknown }
  ? "pattern"
  : O extends { number: unknown }
    ? "number"
    : O extends { currency: unknown }
      ? "currency"
      : "date";

export function kindOf(options: MaskOptions): MaskKind {
  if (options.mask !== undefined) return "pattern";
  if (options.number !== undefined) return "number";
  if (options.currency !== undefined) return "currency";
  return "date";
}

/**
 * Defines a reusable mask under a name. The name also prefixes its error keys (`plate.incomplete`).
 *
 * @example
 * export const plate = definePreset("plate", { mask: "99 a[aa] 99[99]", transform: "uppercase" });
 */
export function definePreset<const O extends MaskOptions>(name: string, options: O): Preset<KindOfOptions<O>> {
  return Object.freeze({ name, kind: kindOf(options), options }) as unknown as Preset<KindOfOptions<O>>;
}

const digits = (value: string) => value.replace(/\D/g, "");

const phone = definePreset("phone", {
  mask: (value: string) => (digits(value).startsWith("90") ? "{+}99 (999) 999 99 99" : "{+}9999999[99999999]"),
  normalize: (value: string) => digits(value).replace(/^0+/, ""),
  inputMode: "tel",
  type: "tel",
  autoComplete: "tel",
});

const phoneTR = definePreset("phoneTR", {
  mask: "(999) 999 99 99",
  normalize: (value: string) => {
    let d = digits(value);
    if (d.length > 10 && d.startsWith("90")) d = d.slice(2);
    return d.replace(/^0+/, "");
  },
  inputMode: "tel",
  type: "tel",
  autoComplete: "tel-national",
});

const iban = definePreset("iban", {
  mask: "aa99 **** **** ***[* **** **** **** **** **** **]",
  transform: "uppercase",
  validate: (value: string) => isValidIBAN(value),
  inputMode: "text",
  autoComplete: "off",
});

const ibanTR = definePreset("ibanTR", {
  mask: "{TR}99 9999 9999 9999 9999 9999 99",
  validate: (value: string) => isValidIBANTR(value),
  inputMode: "numeric",
  autoComplete: "off",
});

const card = definePreset("card", {
  mask: (value: string) => (getCardType(value) === "amex" ? "9999 999999 99999" : "9999 9999 9999 9999"),
  validate: (value: string) => isValidLuhn(value),
  inputMode: "numeric",
  autoComplete: "cc-number",
});

const cvv = definePreset("cvv", {
  mask: (_value: string, ctx) => (getCardType(String(ctx.from ?? "")) === "amex" ? "9999" : "999"),
  inputMode: "numeric",
  autoComplete: "cc-csc",
});

const expiry = definePreset("expiry", {
  date: { format: "MM/YY", min: "today" },
  autoComplete: "cc-exp",
});

const tckn = definePreset("tckn", {
  mask: "99999999999",
  validate: (value: string) => isValidTCKN(value),
  inputMode: "numeric",
  autoComplete: "off",
});

const vkn = definePreset("vkn", {
  mask: "9999999999",
  validate: (value: string) => isValidVKN(value),
  inputMode: "numeric",
  autoComplete: "off",
});

const currency = definePreset("currency", { currency: { code: "TRY" }, autoComplete: "off" });
const number = definePreset("number", { number: {}, autoComplete: "off" });
const date = definePreset("date", { date: { format: "DD/MM/YYYY" } });

export const presets = Object.freeze({
  phone,
  phoneTR,
  iban,
  ibanTR,
  card,
  cvv,
  expiry,
  tckn,
  vkn,
  currency,
  number,
  date,
});

export type Presets = typeof presets;
export type PresetName = keyof Presets;
export type PresetKind<P extends PresetName> = Presets[P]["kind"];

export function isPresetName(value: unknown): value is PresetName {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(presets, value);
}
