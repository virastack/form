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

/** ISO 13616 mod-97 check. Works for every country; spaces are ignored. */
export function isValidIBAN(value: string): boolean {
  const iban = value.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const code = char.charCodeAt(0);
    const chunk = code >= 65 ? String(code - 55) : char;
    for (const digit of chunk) remainder = (remainder * 10 + (digit.charCodeAt(0) - 48)) % 97;
  }
  return remainder === 1;
}

/** Turkish IBAN: `TR` + 24 digits and a valid checksum. */
export function isValidIBANTR(value: string): boolean {
  const iban = value.replace(/\s/g, "").toUpperCase();
  return /^TR\d{24}$/.test(iban) && isValidIBAN(iban);
}
