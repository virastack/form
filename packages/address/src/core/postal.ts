import type { AddressNeighbourhood } from "./types.js";

/**
 * A postal code as five digits, or null when it is not one. Spaces are
 * dropped, so "34 096" from a pasted address still counts.
 */
export function normalizePostalCode(input: string | number | null | undefined): string | null {
  if (input == null) return null;
  const digits = String(input).replace(/\s/g, "");
  return /^\d{5}$/.test(digits) ? digits : null;
}

/**
 * The plate code a postal code belongs to: its first two digits. Every code in
 * the PTT data starts with the plate of its province.
 */
export const provinceCodeOf = (postalCode: string): number => Number(postalCode.slice(0, 2));

export interface PostalCodeHit {
  readonly district: string;
  readonly neighbourhoods: readonly AddressNeighbourhood[];
}

/**
 * Every district of one province that has neighbourhoods under this postal
 * code, with those neighbourhoods. One entry in the bundled data, always: no
 * code spans two districts, and the data build fails if one ever does.
 */
export function matchPostalCode(
  byDistrict: ReadonlyMap<string, readonly AddressNeighbourhood[]>,
  postalCode: string,
): readonly PostalCodeHit[] {
  const hits: PostalCodeHit[] = [];
  for (const [district, list] of byDistrict) {
    const neighbourhoods = list.filter((n) => n.postalCodes.includes(postalCode));
    if (neighbourhoods.length > 0) hits.push({ district, neighbourhoods });
  }
  return hits;
}
