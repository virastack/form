/**
 * A name as it should read in a dropdown: "AKKAPI MAH." becomes "Akkapı Mah.".
 * Turkish casing throughout, since a naive toLowerCase turns "I" into "i"
 * instead of "ı".
 */
export function formatName(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/(^|[\s./(-])([\p{L}])/gu, (_, lead: string, letter: string) => lead + letter.toLocaleUpperCase("tr"));
}

/** A key to search by: case and Turkish diacritics ignored, so "kadikoy" finds "KADIKÖY". */
export function toSearchKey(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

/** Sorts names in Turkish alphabetical order: Ç after C, İ after I, and so on. */
export const compareNames = (a: string, b: string): number =>
  a.toLocaleLowerCase("tr").localeCompare(b.toLocaleLowerCase("tr"), "tr");

/** The parts `formatAddress` reads. The hook's `value` and `resolveAddress` results fit as they are. */
export interface AddressLineInput {
  readonly province?: string | null;
  readonly district?: string | null;
  readonly neighbourhood?: string | null;
  readonly postalCode?: string | null;
}

export interface FormatAddressOptions {
  /** Puts the postal code before the district, as on an envelope. Defaults to false. */
  postalCode?: boolean;
  /** Between the district and the province. Defaults to "/". */
  separator?: string;
}

/**
 * The address on one line: "Alandüzü Mah. Adapazarı/Sakarya", or with
 * `postalCode`, "Alandüzü Mah. 54100 Adapazarı/Sakarya". A level that is not
 * picked yet is left out, so a half-filled form still reads cleanly.
 */
export function formatAddress(value: AddressLineInput, options: FormatAddressOptions = {}): string {
  const { postalCode = false, separator = "/" } = options;
  const place = [value.district, value.province]
    .filter((name): name is string => Boolean(name))
    .map(formatName)
    .join(separator);
  return [value.neighbourhood ? formatName(value.neighbourhood) : "", postalCode ? (value.postalCode ?? "") : "", place]
    .filter(Boolean)
    .join(" ");
}
