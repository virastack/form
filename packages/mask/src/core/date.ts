import type { DateConfig, DateFormat, DateLimit } from "./types";

export interface DateSegment {
  type: "D" | "M" | "Y";
  length: number;
}

export interface DateLayout {
  segments: DateSegment[];
  pattern: string;
  /** True when the format has day, month and a 4-digit year, so the value can be ISO. */
  full: boolean;
}

export interface DateParts {
  year: number;
  month: number;
  day?: number;
}

export function dateLayout(format: DateFormat): DateLayout {
  const segments: DateSegment[] = [];
  let pattern = "";
  const re = /YYYY|YY|MM|DD|./g;
  for (const match of format.match(re) ?? []) {
    if (match === "DD" || match === "MM" || match === "YY" || match === "YYYY") {
      segments.push({ type: match[0] as DateSegment["type"], length: match.length });
      pattern += "9".repeat(match.length);
    } else {
      pattern += `\\${match}`;
    }
  }
  const has = (type: DateSegment["type"], length?: number) =>
    segments.some((s) => s.type === type && (length === undefined || s.length === length));
  return { segments, pattern, full: has("D") && has("M") && has("Y", 4) };
}

/**
 * Fixes digits as they are typed: `4` in a day becomes `04`, a month can't pass 12, a day can't pass 31.
 * Rejected digits are dropped.
 */
export function correctDateDigits(digits: string, layout: DateLayout): string {
  let out = "";
  let index = 0;
  for (const segment of layout.segments) {
    let part = "";
    while (part.length < segment.length && index < digits.length) {
      const digit = digits[index++];
      if (segment.type === "Y") {
        part += digit;
        continue;
      }
      const limit = segment.type === "D" ? 31 : 12;
      const firstMax = segment.type === "D" ? 3 : 1;
      if (part === "") {
        if (Number(digit) > firstMax) part = `0${digit}`;
        else part = digit;
      } else {
        const value = Number(part + digit);
        if (value === 0 || value > limit) continue;
        part += digit;
      }
    }
    out += part;
    if (part.length < segment.length) break;
  }
  return out;
}

export function digitsToParts(digits: string, layout: DateLayout): DateParts | undefined {
  let index = 0;
  const parts: Partial<Record<DateSegment["type"], number>> = {};
  for (const segment of layout.segments) {
    const chunk = digits.slice(index, index + segment.length);
    if (chunk.length !== segment.length) return undefined;
    let value = Number(chunk);
    if (segment.type === "Y" && segment.length === 2) value += 2000;
    parts[segment.type] = value;
    index += segment.length;
  }
  if (parts.Y === undefined || parts.M === undefined) return undefined;
  return { year: parts.Y, month: parts.M, day: parts.D };
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isoToDigits(iso: string, layout: DateLayout): string | undefined {
  const match = ISO.exec(iso);
  if (!match) return undefined;
  const [, year, month, day] = match;
  let out = "";
  for (const segment of layout.segments) {
    if (segment.type === "D") out += day;
    else if (segment.type === "M") out += month;
    else out += segment.length === 2 ? year.slice(2) : year;
  }
  return out;
}

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

export function partsToIso({ year, month, day = 1 }: DateParts): string {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

export function isRealDate({ year, month, day }: DateParts): boolean {
  if (month < 1 || month > 12) return false;
  if (day === undefined) return true;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function today(): DateParts {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

export function limitToParts(limit: DateLimit | unknown): DateParts | undefined {
  if (limit === "today") return today();
  if (limit instanceof Date) {
    return Number.isNaN(limit.getTime())
      ? undefined
      : { year: limit.getFullYear(), month: limit.getMonth() + 1, day: limit.getDate() };
  }
  if (typeof limit === "string") {
    const match = ISO.exec(limit);
    if (match) return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  }
  return undefined;
}

/** Compares by day when both sides have one, otherwise by month. */
export function compareParts(a: DateParts, b: DateParts): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  if (a.day === undefined || b.day === undefined) return 0;
  return a.day - b.day;
}

export function ageOn(birth: DateParts, on: DateParts): number {
  let age = on.year - birth.year;
  if (on.month < birth.month || (on.month === birth.month && (on.day ?? 1) < (birth.day ?? 1))) age--;
  return age;
}

export type DateError = "incomplete" | "invalid" | "min" | "max" | "minAge" | "beforeFrom";

export function checkDate(
  digits: string,
  layout: DateLayout,
  config: DateConfig,
  from: unknown,
): DateError | undefined {
  const parts = digitsToParts(digits, layout);
  if (!parts) return "incomplete";
  if (!isRealDate(parts)) return "invalid";

  const min = config.min === undefined ? undefined : limitToParts(config.min);
  if (min && compareParts(parts, min) < 0) return "min";
  const max = config.max === undefined ? undefined : limitToParts(config.max);
  if (max && compareParts(parts, max) > 0) return "max";
  if (config.minAge !== undefined && parts.day !== undefined && ageOn(parts, today()) < config.minAge) {
    return "minAge";
  }

  const start = typeof from === "string" ? limitToParts(from) : from instanceof Date ? limitToParts(from) : undefined;
  if (start && compareParts(parts, start) < 0) return "beforeFrom";
  return undefined;
}
