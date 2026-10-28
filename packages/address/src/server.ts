import { neighbourhoods as loadNeighbourhoods, provinces } from "./data.js";

import { compareTr, foldTr } from "./core/format.js";
import type { AddressValue } from "./core/types.js";

export interface AddressInput {
  provinceCode?: string | number | null;
  province?: string | null;
  district?: string | null;
  neighbourhood?: string | null;
}

export type AddressIssue =
  | { level: "province"; reason: "missing" | "unknown" }
  | { level: "district"; reason: "missing" | "unknown" }
  | { level: "neighbourhood"; reason: "missing" | "unknown" };

export interface AddressResult {
  ok: boolean;
  value: AddressValue;
  issues: readonly AddressIssue[];
}

const EMPTY: AddressValue = {
  provinceCode: null,
  province: null,
  district: null,
  neighbourhood: null,
  postalCode: null,
  postalCodes: [],
};

/**
 * Look a province up by plate code, written as 6, "6" or "06", or by name
 * however it was cased.
 */
export function findProvince(input: string | number | null | undefined) {
  if (input == null || input === "") return undefined;
  const asText = String(input).trim();
  if (/^\d+$/.test(asText)) return provinces.find((p) => p.code === Number(asText));
  const folded = foldTr(asText);
  return provinces.find((p) => foldTr(p.name) === folded);
}

/**
 * Re-checks a submitted address against the dataset and derives the postal
 * code, so a client can never decide what a neighbourhood's code is.
 */
export async function resolveAddress(input: AddressInput): Promise<AddressResult> {
  const issues: AddressIssue[] = [];
  // An empty field from a form counts as not sent, so the name still gets a say.
  const asked = input.provinceCode || input.province;
  const province = findProvince(asked);

  if (!province) {
    issues.push({ level: "province", reason: asked ? "unknown" : "missing" });
    return { ok: false, value: EMPTY, issues };
  }

  const value: AddressValue = { ...EMPTY, provinceCode: String(province.code), province: province.name };

  if (!input.district) {
    issues.push({ level: "district", reason: "missing" });
    return { ok: false, value, issues };
  }

  const district = province.districts.find((d) => foldTr(d) === foldTr(input.district?.trim() ?? ""));
  if (!district) {
    issues.push({ level: "district", reason: "unknown" });
    return { ok: false, value, issues };
  }

  const withDistrict = { ...value, district };

  if (!input.neighbourhood) {
    issues.push({ level: "neighbourhood", reason: "missing" });
    return { ok: false, value: withDistrict, issues };
  }

  const list = (await loadNeighbourhoods(province.code)).get(district) ?? [];
  const match = list.find((n) => foldTr(n.name) === foldTr(input.neighbourhood?.trim() ?? ""));
  if (!match) {
    issues.push({ level: "neighbourhood", reason: "unknown" });
    return { ok: false, value: withDistrict, issues };
  }

  return {
    ok: true,
    value: {
      ...withDistrict,
      neighbourhood: match.name,
      postalCode: match.postalCode,
      postalCodes: match.postalCodes,
    },
    issues,
  };
}

/** The postal code for one neighbourhood, or null when nothing matches. */
export async function postalCodeFor(input: AddressInput): Promise<string | null> {
  return (await resolveAddress(input)).value.postalCode;
}

/** District names of one province, sorted the way Turkish sorts them. */
export function districtsOf(input: string | number): readonly string[] {
  return [...(findProvince(input)?.districts ?? [])].sort(compareTr);
}

export { provinces };
