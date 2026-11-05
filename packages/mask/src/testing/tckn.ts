import { tcknCheckDigits } from "../core/validators";
import { createRandom, randomDigits, randomInt } from "./random";

export interface GenerateTCKNOptions {
  /** An integer. The same seed gives the same number on every run. */
  seed?: number;
}

/**
 * A TCKN that passes `isValidTCKN`, such as `"10000000146"`. For tests and seed
 * data only: a number that fits the algorithm can belong to a real person.
 *
 * @example
 * generateTCKN();             // a new number on every call
 * generateTCKN({ seed: 1 });  // the same number on every run
 */
export function generateTCKN({ seed }: GenerateTCKNOptions = {}): string {
  const random = createRandom(seed, "tckn");
  const firstNine = `${randomInt(random, 1, 9)}${randomDigits(random, 8)}`;
  return firstNine + tcknCheckDigits(firstNine);
}
