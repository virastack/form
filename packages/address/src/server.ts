import { provinces, neighbourhoods as loadNeighbourhoods } from "@virastack/address-data";

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

/** Look a province up by plate code, or by name however it was cased. */
export function findProvince(input: string | number | null | undefined) {
  if (input == null || input === "") return undefined;
  const asText = String(input);
  const byCode = provinces.find((p) => String(p.code) === asText);
  if (byCode) return byCode;
  const folded = foldTr(asText);
  return provinces.find((p) => foldTr(p.name) === folded);
}

/**
 * Re-checks a submitted address against the dataset and derives the postal
 * code, so a client can never decide what a neighbourhood's code is.
 */
export async function resolveAddress(input: AddressInput): Promise<AddressResult> {
  const issues: AddressIssue[] = [];
  const province = findProvince(input.provinceCode ?? input.province);

  if (!province) {
    issues.push({ level: "province", reason: input.provinceCode ?? input.province ? "unknown" : "missing" });
    return { ok: false, value: EMPTY, issues };
  }

  const value: AddressValue = { ...EMPTY, provinceCode: String(province.code), province: province.name };

  if (!input.district) {
    issues.push({ level: "district", reason: "missing" });
    return { ok: false, value, issues };
  }

  const district = province.districts.find((d) => foldTr(d) === foldTr(input.district ?? ""));
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
  const match = list.find((n) => foldTr(n.name) === foldTr(input.neighbourhood ?? ""));
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
