export type CardType = "visa" | "mastercard" | "amex" | "troy" | "unknown";

const digitsOnly = (value: string) => value.replace(/\D/g, "");

/** Detects the card network from the leading digits. */
export function getCardType(value: string): CardType {
  const digits = digitsOnly(value);
  if (/^3[47]/.test(digits)) return "amex";
  if (/^9792/.test(digits)) return "troy";
  if (/^4/.test(digits)) return "visa";
  if (/^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d{2}|27[01]\d|2720)/.test(digits)) return "mastercard";
  return "unknown";
}

/** Card number length for a network (Amex 15, others 16). */
export function cardLength(type: CardType): number {
  return type === "amex" ? 15 : 16;
}

/** Luhn checksum. Accepts formatted input. */
export function isValidLuhn(value: string): boolean {
  const digits = digitsOnly(value);
  if (digits.length < 2) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits.charCodeAt(i) - 48;
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Card number: right length for its network and a valid Luhn checksum. */
export function isValidCard(value: string): boolean {
  const digits = digitsOnly(value);
  return digits.length === cardLength(getCardType(digits)) && isValidLuhn(digits);
}

/** Turkish national ID (T.C. Kimlik No). */
export function isValidTCKN(value: string): boolean {
  if (!/^[1-9]\d{10}$/.test(value)) return false;
  const d = [...value].map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  const tenth = (((odd * 7 - even) % 10) + 10) % 10;
  const eleventh = d.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10;
  return d[9] === tenth && d[10] === eleventh;
}

/** Turkish tax number (Vergi Kimlik No). */
export function isValidVKN(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false;
  const d = [...value].map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const n1 = (d[i] + 9 - i) % 10;
    const n2 = (n1 * 2 ** (9 - i)) % 9;
    sum += n1 !== 0 && n2 === 0 ? 9 : n2;
  }
  return d[9] === (10 - (sum % 10)) % 10;
}

/**
 * IBAN length per country, from the SWIFT IBAN registry.
 * Countries not listed are checked with the generic 15–34 rule.
 */
const IBAN_LENGTHS: Readonly<Record<string, number>> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BI: 27, BR: 29, BY: 28,
  CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22, DJ: 27, DK: 18, DO: 28, EE: 20, EG: 29, ES: 24, FI: 18,
  FK: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23, GL: 18, GR: 27, GT: 28, HN: 28, HR: 21, HU: 28,
  IE: 22, IL: 23, IQ: 23, IS: 26, IT: 27, JO: 30, KW: 30, KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20,
  LU: 20, LV: 21, LY: 25, MC: 27, MD: 24, ME: 22, MK: 19, MN: 20, MR: 27, MT: 31, MU: 30, NI: 28,
  NL: 18, NO: 15, OM: 23, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29, RO: 24, RS: 22, RU: 33, SA: 24,
  SC: 31, SD: 18, SE: 24, SI: 19, SK: 24, SM: 27, SO: 23, ST: 25, SV: 28, TL: 23, TN: 24, TR: 26,
  UA: 29, VA: 22, VG: 24, XK: 20, YE: 30,
};

/**
 * IBAN check for every country: the country code sets the length (TR → 26),
 * then the ISO 13616 mod-97 checksum. Spaces and lowercase are accepted.
 */
export function isValidIBAN(value: string): boolean {
  const iban = value.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const length = IBAN_LENGTHS[iban.slice(0, 2)];
  if (length !== undefined && iban.length !== length) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const code = char.charCodeAt(0);
    const chunk = code >= 65 ? String(code - 55) : char;
    for (const digit of chunk) remainder = (remainder * 10 + (digit.charCodeAt(0) - 48)) % 97;
  }
  return remainder === 1;
}
