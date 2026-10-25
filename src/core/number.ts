import { diffText, isForwardDelete } from "./diff";
import type { EditInput, EditResult } from "./types";

export interface NumberFormatInfo {
  decimal: string;
  group: string;
  prefix: string;
  suffix: string;
  scale: number;
  signed: boolean;
  min?: number;
  max?: number;
}

const partsCache = new Map<string, { decimal: string; group: string; prefix: string; suffix: string; digits: number }>();

/** Reads separators and the currency symbol's position from Intl, once per locale/currency. */
export function intlParts(locale: string, currency?: string) {
  const key = `${locale}|${currency ?? ""}`;
  const hit = partsCache.get(key);
  if (hit) return hit;

  const formatter = new Intl.NumberFormat(locale, {
    ...(currency ? { style: "currency" as const, currency, currencyDisplay: "narrowSymbol" as const } : {}),
    useGrouping: true,
  });
  const parts = formatter.formatToParts(1234567.5);
  let decimal = ".";
  let group = ",";
  let prefix = "";
  let suffix = "";
  let seenNumber = false;

  for (const part of parts) {
    if (part.type === "integer" || part.type === "fraction") {
      seenNumber = true;
    } else if (part.type === "decimal") {
      decimal = part.value;
    } else if (part.type === "group") {
      group = part.value;
    } else if (part.type === "currency" || part.type === "literal") {
      if (seenNumber) suffix += part.value;
      else prefix += part.value;
    }
  }

  const info = { decimal, group, prefix, suffix, digits: formatter.resolvedOptions().maximumFractionDigits ?? 0 };
  partsCache.set(key, info);
  return info;
}

const CANONICAL = /^-?\d*(\.\d*)?$/;

/** `1234.5` style string → display, keeping a trailing decimal while typing (`1234.` → `1.234,`). */
export function formatNumber(canonical: string, info: NumberFormatInfo): string {
  if (canonical === "" || canonical === "-") return canonical;
  const negative = canonical.startsWith("-");
  const body = negative ? canonical.slice(1) : canonical;
  const [int = "", frac] = body.split(".");
  const grouped = (int || "0").replace(/\B(?=(\d{3})+(?!\d))/g, info.group);
  const number = frac === undefined ? grouped : `${grouped}${info.decimal}${frac}`;
  return `${negative ? "-" : ""}${info.prefix}${number}${info.suffix}`;
}

/** Strips affixes and separators from locale text. A lone `.` is read as a decimal when it can't be a group. */
export function parseLooseNumber(text: string, info: NumberFormatInfo): string {
  let source = text.trim();
  if (info.prefix) source = source.split(info.prefix.trim()).join("");
  if (info.suffix) source = source.split(info.suffix.trim()).join("");

  const negative = info.signed && /^\s*-/.test(source);
  let decimalChar = info.decimal;

  if (!source.includes(info.decimal)) {
    const dots = source.split(".").length - 1;
    const afterDot = source.slice(source.lastIndexOf(".") + 1).replace(/\D/g, "");
    // `1234.56` pasted into a `1.234,56` locale: the dot can't be a thousands separator.
    if (dots === 1 && (info.group !== "." || afterDot.length !== 3)) decimalChar = ".";
  }

  let out = "";
  let seenDecimal = false;
  for (const char of source) {
    if (char >= "0" && char <= "9") out += char;
    else if (char === decimalChar && !seenDecimal) {
      out += ".";
      seenDecimal = true;
    }
  }
  return clean((negative ? "-" : "") + out, info);
}

/** Canonical cleanup: one sign, one dot, no leading zeros, `scale` fraction digits, `max` clamp. */
function clean(value: string, info: NumberFormatInfo): string {
  let negative = value.startsWith("-") && info.signed;
  let body = value.replace(/-/g, "");
  const dot = body.indexOf(".");
  let int = dot === -1 ? body : body.slice(0, dot);
  let frac = dot === -1 ? undefined : body.slice(dot + 1).replace(/\./g, "");

  int = int.replace(/^0+(?=\d)/, "");
  if (frac !== undefined) {
    if (info.scale === 0) frac = undefined;
    else {
      frac = frac.slice(0, info.scale);
      if (int === "") int = "0";
    }
  }
  body = frac === undefined ? int : `${int}.${frac}`;

  if (body !== "" && info.max !== undefined && Number(negative ? `-${body}` : body) > info.max) {
    const max = String(info.max);
    negative = max.startsWith("-");
    body = max.replace("-", "");
  }
  if (negative && body === "") return "-";
  return negative ? `-${body}` : body;
}

/** Display or typing state → form value (drops a trailing `.` or lone `-`). */
export function toNumberValue(canonical: string): string {
  if (canonical === "-" || canonical === "") return "";
  return canonical.endsWith(".") ? canonical.slice(0, -1) : canonical;
}

export function canonicalNumber(value: unknown, info: NumberFormatInfo): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? clean(String(value), info) : "";
  const text = String(value);
  return CANONICAL.test(text) ? clean(text, info) : parseLooseNumber(text, info);
}

function isSignificant(char: string, info: NumberFormatInfo): boolean {
  return (char >= "0" && char <= "9") || char === info.decimal || char === "-";
}

/** Reads typed text using locale rules; `typedDecimal` marks the one character the user just typed as a decimal. */
function readTyped(text: string, info: NumberFormatInfo, typedDecimalAt: number): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char >= "0" && char <= "9") out += char;
    else if (i === typedDecimalAt || char === info.decimal) out += ".";
    else if (char === "-" && info.signed && out === "") out += "-";
  }
  return out;
}

export function editNumber(input: EditInput, info: NumberFormatInfo): EditResult {
  const { previous, inputType } = input;
  let next = input.value;
  let caret = input.selectionStart ?? next.length;
  const change = diffText(previous, next, caret);

  const removed = previous.slice(change.start, change.removedEnd);
  if (change.inserted === "" && removed !== "" && ![...removed].some((char) => isSignificant(char, info))) {
    // Only a separator or symbol was deleted; remove the digit next to it so the edit has an effect.
    if (isForwardDelete(inputType)) {
      let at = change.start;
      while (at < next.length && !isSignificant(next[at], info)) at++;
      next = next.slice(0, at) + next.slice(at + 1);
    } else {
      let at = change.start - 1;
      while (at >= 0 && !isSignificant(next[at], info)) at--;
      if (at >= 0) {
        next = next.slice(0, at) + next.slice(at + 1);
        caret = at;
      }
    }
  }

  let head: string;
  let tail: string;
  const insertedEnd = change.start + change.inserted.length;

  if (change.inserted.length > 1) {
    // Paste or autofill: read the pasted text on its own with loose locale rules.
    const pasted = parseLooseNumber(change.inserted, { ...info, max: undefined, scale: Math.max(info.scale, 20) });
    head = readTyped(next.slice(0, change.start), info, -1) + pasted;
    tail = readTyped(next.slice(insertedEnd), info, -1);
  } else {
    // Group separators are inserted by the mask, so a typed "," or "." always means the decimal
    // (typing "1234,56" in an en-US field must not become 123456).
    const typedDecimalAt =
      change.inserted.length === 1 &&
      (change.inserted === "." || change.inserted === "," || change.inserted === info.decimal) &&
      info.scale > 0
        ? change.start
        : -1;
    const split = Math.min(caret, next.length);
    head = readTyped(next.slice(0, split), info, typedDecimalAt);
    tail = readTyped(next.slice(split), info, typedDecimalAt - split);
  }

  // A second decimal point: keep the one just typed only when none existed.
  if (head.includes(".") && tail.includes(".")) tail = tail.replace(/\./g, "");

  const full = clean(head + tail, info);
  const headClean = clean(head, { ...info, max: undefined });
  const display = formatNumber(full, info);

  let count = Math.min(headClean.length, full.length);
  if (full !== clean(head + tail, { ...info, max: undefined })) count = full.length;

  let cursor = display.length - info.suffix.length;
  let seen = 0;
  if (count === 0) cursor = full.startsWith("-") ? 1 + info.prefix.length : info.prefix.length;
  else {
    for (let i = 0; i < display.length; i++) {
      if (isSignificant(display[i], info)) seen++;
      if (seen === count) {
        cursor = i + 1;
        break;
      }
    }
  }
  if (display === "") cursor = 0;

  const value = toNumberValue(full);
  return { value, display, cursor, complete: value !== "" };
}
