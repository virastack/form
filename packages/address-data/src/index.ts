import index from "../data/index.json";

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

const defaultLoader: Loader = async (provinceCode) => {
  const mod = (await import(`../data/provinces/${provinceCode}.mjs`)) as { default: string };
  return mod.default;
};

let loader: Loader = defaultLoader;

/** Swap in a loader that reads from disk, a CDN or your own endpoint. */
export function setLoader(next: Loader | null): void {
  loader = next ?? defaultLoader;
}

const cache = new Map<number, ReadonlyMap<string, readonly Neighbourhood[]>>();

function parse(payload: string): ReadonlyMap<string, readonly Neighbourhood[]> {
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
 * name. Cached, so picking a province again costs nothing.
 */
export async function neighbourhoods(provinceCode: number): Promise<ReadonlyMap<string, readonly Neighbourhood[]>> {
  const hit = cache.get(provinceCode);
  if (hit) return hit;
  const parsed = parse(await loader(provinceCode));
  cache.set(provinceCode, parsed);
  return parsed;
}
