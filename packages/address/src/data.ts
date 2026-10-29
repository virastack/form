import index from "../data/index.json";

import { matchPostalCode, normalizePostalCode, provinceCodeOf } from "./core/postal.js";

export interface Province {
  /** Plate code, 1-81. */
  readonly code: number;
  readonly name: string;
  readonly districts: readonly string[];
}

export interface Neighbourhood {
  readonly name: string;
  /** Five digit postal code. The first one when a neighbourhood has several. */
  readonly postalCode: string;
  /**
   * Every postal code the neighbourhood covers. Almost always one entry; a few
   * hundred neighbourhoods are split across up to eight codes.
   */
  readonly postalCodes: readonly string[];
}

export interface Source {
  readonly source: string;
  /** ISO date the data was collected. */
  readonly date: string;
  readonly provinces: number;
  readonly districts: number;
  readonly neighbourhoods: number;
}

const meta = index as unknown as { counts: Omit<Source, "source" | "date">; source: string; date: string; provinces: Province[] };

/** Provinces with their district names. Bundled, no request needed. */
export const provinces: readonly Province[] = meta.provinces;

export const source: Source = {
  source: meta.source,
  date: meta.date,
  ...meta.counts,
};

const byCode = new Map(provinces.map((p) => [p.code, p]));

export function province(code: number): Province | undefined {
  return byCode.get(code);
}

export function districts(provinceCode: number): readonly string[] {
  return byCode.get(provinceCode)?.districts ?? [];
}

/**
 * Reads one province's payload. Defaults to importing the generated module,
 * which leaves the bundler one chunk per province to split out.
 */
export type Loader = (provinceCode: number) => Promise<string>;

// The import map is shipped as data next to the payloads and kept out of our
// own bundle: inlined, the CommonJS build would carry every province at once.
const defaultLoader: Loader = async (provinceCode) => {
  const { load } = await import("../data/load.mjs");
  return load(provinceCode);
};

let loader: Loader = defaultLoader;

type Parsed = ReadonlyMap<string, readonly Neighbourhood[]>;

// Promises, not results, so two callers asking for the same province at once
// share one load.
const cache = new Map<number, Promise<Parsed>>();

/**
 * Swap in a loader that reads from disk, a CDN or your own endpoint. Pass null
 * to go back to the bundled modules. Provinces read so far are forgotten.
 */
export function setLoader(next: Loader | null): void {
  loader = next ?? defaultLoader;
  cache.clear();
}

function parse(payload: string): Parsed {
  const out = new Map<string, readonly Neighbourhood[]>();
  if (!payload) return out;
  for (const line of payload.split("\n")) {
    const split = line.indexOf(";");
    const district = line.slice(0, split);
    const rest = line.slice(split + 1);
    const items: Neighbourhood[] = [];
    if (rest) {
      for (const entry of rest.split("|")) {
        // Names may contain a comma, so the postal codes are read after the
        // last colon and only then split.
        const at = entry.lastIndexOf(":");
        const postalCodes = entry.slice(at + 1).split(",");
        items.push({ name: entry.slice(0, at), postalCode: postalCodes[0] ?? "", postalCodes });
      }
    }
    out.set(district, items);
  }
  return out;
}

/**
 * Every district of one province with its neighbourhoods, keyed by district
 * name. Cached, so picking a province again costs nothing. A code that is not
 * a province gives an empty map.
 */
export function neighbourhoods(provinceCode: number): Promise<Parsed> {
  const hit = cache.get(provinceCode);
  if (hit) return hit;
  const pending = Promise.resolve(provinceCode).then(loader).then(parse);
  cache.set(provinceCode, pending);
  // A failed load is not remembered, so picking the province again retries it.
  pending.catch(() => {
    if (cache.get(provinceCode) === pending) cache.delete(provinceCode);
  });
  return pending;
}

export interface PostalCodeMatch {
  readonly postalCode: string;
  readonly province: Province;
  readonly district: string;
  /**
   * Every neighbourhood under the code, in the district. One entry means the
   * code alone gives the whole address; most codes cover several.
   */
  readonly neighbourhoods: readonly Neighbourhood[];
}

/**
 * Where a postal code is. Only the province it starts with is loaded. Gives
 * null for anything that is not a five digit code in the dataset; spaces are
 * ignored, so "34 096" works.
 */
export async function findPostalCode(input: string | number): Promise<PostalCodeMatch | null> {
  const postalCode = normalizePostalCode(input);
  if (postalCode === null) return null;
  const found = province(provinceCodeOf(postalCode));
  if (!found) return null;
  // No code spans two districts; the data build fails if one ever does.
  const [hit] = matchPostalCode(await neighbourhoods(found.code), postalCode);
  return hit ? { postalCode, province: found, district: hit.district, neighbourhoods: hit.neighbourhoods } : null;
}
