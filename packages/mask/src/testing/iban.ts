import { turkishBanks } from "../core/banks";
import { IBAN_LENGTHS, mod97 } from "../core/validators";
import { createRandom, randomDigits, randomInt } from "./random";

export interface GenerateIBANOptions {
  /** Turkish IBANs only: a four-digit code from `turkishBanks`, such as `"0062"`. Picked at random when left out. */
  bank?: string;
  /** An integer. The same seed gives the same IBAN on every run. */
  seed?: number;
}

/**
 * An IBAN that passes `isValidIBAN`, without spaces: `"TR510006205723862795695348"`.
 * A Turkish IBAN follows the national layout (bank code from `turkishBanks`,
 * reserve digit `0`, 16-digit account), so `getTurkishBank` finds its bank.
 * Other countries get a digits-only BBAN of the registry length: it passes the
 * length and mod-97 checks, not national rules such as letters in a UK bank code.
 * For tests and seed data only: a generated IBAN can match a real account.
 *
 * @example
 * generateIBAN();                     // a Turkish IBAN at a random bank
 * generateIBAN("TR", { bank: "0062" }); // Garanti
 * generateIBAN("DE", { seed: 1 });    // the same German IBAN on every run
 */
export function generateIBAN(country = "TR", { bank, seed }: GenerateIBANOptions = {}): string {
  const code = country.toUpperCase();
  const length = IBAN_LENGTHS[code];
  if (length === undefined) {
    throw new RangeError(`generateIBAN: "${country}" is not in the IBAN registry. Use a code such as "TR" or "DE".`);
  }
  if (bank !== undefined && code !== "TR") {
    throw new TypeError(`generateIBAN: the bank option is for Turkish IBANs only, not "${code}".`);
  }
  if (bank !== undefined && !turkishBanks.some((entry) => entry.code === bank)) {
    throw new RangeError(`generateIBAN: "${bank}" is not a bank code in turkishBanks. Use four digits, such as "0062".`);
  }

  const random = createRandom(seed, `iban:${code}`);
  const bban =
    code === "TR"
      ? `0${bank ?? turkishBanks[randomInt(random, 0, turkishBanks.length - 1)].code}0${randomDigits(random, 16)}`
      : randomDigits(random, length - 4);
  const check = String(98 - mod97(`${bban}${code}00`)).padStart(2, "0");
  return `${code}${check}${bban}`;
}
