/**
 * Converts a decimal string to integer minor units without float math.
 * `scale` is a number of fraction digits or an ISO 4217 code (`"TRY"` → 2, `"JPY"` → 0).
 * Extra fraction digits are truncated. Returns `NaN` for anything that isn't a plain decimal.
 *
 * @example
 * toMinorUnits("1234.56", "TRY"); // 123456
 */
export function toMinorUnits(value: string | number, scale: number | string = 2): number {
  const digits =
    typeof scale === "number"
      ? scale
      : (new Intl.NumberFormat("en-US", { style: "currency", currency: scale }).resolvedOptions()
          .maximumFractionDigits ?? 2);
  const text = typeof value === "number" ? numberToPlain(value) : value.trim();
  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(text);
  if (!match || (match[2] === "" && !match[3])) return Number.NaN;
  const [, sign, int, frac = ""] = match;
  const minor = Number(`${int || "0"}${frac.padEnd(digits, "0").slice(0, digits)}`);
  return sign && minor !== 0 ? -minor : minor;
}

function numberToPlain(value: number): string {
  if (!Number.isFinite(value)) return "";
  const text = String(value);
  // Exponent notation only shows up for very small or very large numbers.
  return /e/i.test(text) ? value.toFixed(20).replace(/\.?0+$/, "") : text;
}
