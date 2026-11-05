/** A source of numbers in [0, 1), like `Math.random`. */
export type Random = () => number;

/** FNV-1a: a 32-bit hash of a short string. */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 0x01000193);
  return value >>> 0;
}

/**
 * `Math.random` without a seed. With one, mulberry32: a small generator that
 * gives the same numbers for the same seed on every run and platform. The seed
 * is only the generator's start value; it maps to no person or table.
 * `stream` keeps generators apart, so `seed: 1` gives unrelated digits for a
 * TCKN and an IBAN.
 */
export function createRandom(seed: number | undefined, stream: string): Random {
  if (seed === undefined) return Math.random;
  if (!Number.isSafeInteger(seed)) throw new TypeError(`seed must be an integer, received ${String(seed)}.`);
  let state = ((seed >>> 0) ^ hash(stream)) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A whole number from `min` to `max`, both included. */
export function randomInt(random: Random, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

export function randomDigits(random: Random, length: number): string {
  let digits = "";
  for (let i = 0; i < length; i++) digits += randomInt(random, 0, 9);
  return digits;
}
