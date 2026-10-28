/**
 * Turkish-aware title case. The source data is upper case ("AKKAPI MAH."),
 * which reads badly in a dropdown, and a naive toLowerCase turns "I" into "i"
 * instead of "ı".
 */
export function titleCaseTr(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/(^|[\s./(-])([\p{L}])/gu, (_, lead: string, letter: string) => lead + letter.toLocaleUpperCase("tr"));
}

/** Fold a string for searching: case and Turkish diacritics ignored. */
export function foldTr(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

export const compareTr = (a: string, b: string): number =>
  a.toLocaleLowerCase("tr").localeCompare(b.toLocaleLowerCase("tr"), "tr");
