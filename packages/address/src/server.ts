import { findPostalCode, neighbourhoods as loadNeighbourhoods, provinces } from "./data.js";

import { compareNames, toSearchKey } from "./core/format.js";
import { normalizePostalCode } from "./core/postal.js";
import type { AddressValue } from "./core/types.js";

export interface AddressInput {
  provinceCode?: string | number | null;
  province?: string | null;
  district?: string | null;
  neighbourhood?: string | null;
  /**
   * The postal code the client sent, if any. It must be one of the
   * neighbourhood's codes, and is the one kept when the neighbourhood has several.
   */
  postalCode?: string | number | null;
}

export type AddressIssue =
  | { level: "province"; reason: "missing" | "unknown" }
  | { level: "district"; reason: "missing" | "unknown" }
  | { level: "neighbourhood"; reason: "missing" | "unknown" }
  | { level: "postalCode"; reason: "missing" | "unknown" | "mismatch" };

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
  const folded = toSearchKey(asText);
  return provinces.find((p) => toSearchKey(p.name) === folded);
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

  const district = province.districts.find((d) => toSearchKey(d) === toSearchKey(input.district?.trim() ?? ""));
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
  const match = list.find((n) => toSearchKey(n.name) === toSearchKey(input.neighbourhood?.trim() ?? ""));
  if (!match) {
    issues.push({ level: "neighbourhood", reason: "unknown" });
    return { ok: false, value: withDistrict, issues };
  }

  const complete: AddressValue = {
    ...withDistrict,
    neighbourhood: match.name,
    postalCode: match.postalCode,
    postalCodes: match.postalCodes,
  };

  // Not sent is fine, the code is derived; sent and wrong is not.
  if (input.postalCode != null && input.postalCode !== "") {
    const sent = normalizePostalCode(input.postalCode);
    if (sent === null || !match.postalCodes.includes(sent)) {
      issues.push({ level: "postalCode", reason: "mismatch" });
      return { ok: false, value: complete, issues };
    }
    return { ok: true, value: { ...complete, postalCode: sent }, issues };
  }

  return { ok: true, value: complete, issues };
}

export interface PostalCodeResult extends AddressResult {
  /**
   * Names of every neighbourhood under the code. With one, `value` is the
   * whole address; with more, the user still picks the neighbourhood.
   */
  neighbourhoods: readonly string[];
}

/**
 * The address a postal code points to, as far as the code alone can say.
 * Province and district always follow from a known code; the neighbourhood
 * only when the code has just one, otherwise `neighbourhoods` lists the
 * candidates and the issue says it is missing.
 */
export async function resolvePostalCode(input: string | number | null | undefined): Promise<PostalCodeResult> {
  if (input == null || String(input).trim() === "") {
    return { ok: false, value: EMPTY, issues: [{ level: "postalCode", reason: "missing" }], neighbourhoods: [] };
  }
  const match = await findPostalCode(input);
  if (!match) {
    return { ok: false, value: EMPTY, issues: [{ level: "postalCode", reason: "unknown" }], neighbourhoods: [] };
  }

  const names = match.neighbourhoods.map((n) => n.name);
  const value: AddressValue = {
    provinceCode: String(match.province.code),
    province: match.province.name,
    district: match.district,
    neighbourhood: null,
    postalCode: match.postalCode,
    postalCodes: [match.postalCode],
  };
  const only = match.neighbourhoods.length === 1 ? match.neighbourhoods[0] : undefined;
  if (!only) {
    return { ok: false, value, issues: [{ level: "neighbourhood", reason: "missing" }], neighbourhoods: names };
  }
  return { ok: true, value: { ...value, neighbourhood: only.name, postalCodes: only.postalCodes }, issues: [], neighbourhoods: names };
}

/** The postal code for one neighbourhood, or null when nothing matches. */
export async function postalCodeFor(input: AddressInput): Promise<string | null> {
  return (await resolveAddress(input)).value.postalCode;
}

/** District names of one province, sorted the way Turkish sorts them. */
export function districtsOf(input: string | number): readonly string[] {
  return [...(findProvince(input)?.districts ?? [])].sort(compareNames);
}

export { provinces };
export { formatAddress, formatName } from "./core/format.js";
export type { AddressLineInput, FormatAddressOptions } from "./core/format.js";
export { normalizePostalCode } from "./core/postal.js";
