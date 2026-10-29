import { toSearchKey } from "./format.js";
import type { AddressLevel, AddressSource, AddressValue } from "./types.js";

export interface AddressFormWriteOptions {
  shouldDirty?: boolean;
  shouldTouch?: boolean;
  shouldValidate?: boolean;
}

/**
 * The part of a form library the hook writes through. React Hook Form's
 * `useForm()` and `useFormContext()` fit as they are, and the field names are
 * checked against the form's own type; nothing is imported from it.
 */
export interface AddressForm<P extends string = string> {
  setValue(name: P, value: string, options?: AddressFormWriteOptions): void;
  /** Read on mount, so an edit form starts from the address it already holds. */
  getValues?(name: P): unknown;
  /**
   * Tells the hook when the form changes the address itself, as `reset()` with
   * loaded data does. React Hook Form's `subscribe` (7.55+) fits as it is.
   */
  subscribe?(options: { name?: readonly P[]; formState: { values: true }; callback: () => void }): () => void;
}

export type AddressField = AddressLevel | "postalCode" | "provinceCode";

/** Where each part of the address lives in the form. */
export type AddressFieldNames<P extends string = string> = Partial<Record<AddressField, P>>;

// The plate code is written only when asked for; everything else by default.
const DEFAULT_NAMES: Partial<Record<AddressField, string>> = {
  province: "province",
  district: "district",
  neighbourhood: "neighbourhood",
  postalCode: "postalCode",
};

export const sameName = (a: string | null, b: string | null): boolean =>
  a === b || (a !== null && b !== null && toSearchKey(a) === toSearchKey(b));

export function fieldName(names: AddressFieldNames | undefined, field: AddressField): string | undefined {
  return names?.[field] ?? DEFAULT_NAMES[field];
}

/**
 * The address a form already holds, as a starting point for the hook. Names
 * are matched however they were cased, since they often come back from a
 * database rather than from this hook.
 */
export function readForm(
  form: AddressForm,
  names: AddressFieldNames | undefined,
  source: AddressSource,
): { provinceCode: number; district: string | null; neighbourhood: string | null } | undefined {
  const read = (field: AddressField): string | null => {
    const name = fieldName(names, field);
    const raw: unknown = name && form.getValues ? form.getValues(name) : null;
    return raw == null || raw === "" ? null : String(raw);
  };
  const code = read("provinceCode");
  const name = read("province");
  const province =
    code !== null
      ? source.provinces.find((p) => String(p.code) === String(Number(code)))
      : name !== null
        ? source.provinces.find((p) => toSearchKey(p.name) === toSearchKey(name))
        : undefined;
  if (!province) return undefined;

  const raw = read("district");
  const district = province.districts.find((d) => raw !== null && toSearchKey(d) === toSearchKey(raw)) ?? null;
  // A neighbourhood means nothing without the district it belongs to.
  return { provinceCode: province.code, district, neighbourhood: district === null ? null : read("neighbourhood") };
}

/**
 * Mirrors a change into the form. A pick writes every level, so clearing the
 * province clears the district in the form too; a postal code that only filled
 * in because the neighbourhoods arrived is not an edit, nor is the dataset's
 * spelling of a name the form already held, and the form stays pristine.
 * A change that came from the form (`fromForm`) is already there, so only a
 * postal code derived from it is written back, quietly.
 */
export function writeForm(
  form: AddressForm,
  names: AddressFieldNames | undefined,
  before: AddressValue,
  value: AddressValue,
  shouldValidate: boolean,
  fromForm = false,
): void {
  if (fromForm) {
    const quiet: AddressFormWriteOptions = { shouldDirty: false, shouldTouch: false, shouldValidate: false };
    const set = (field: AddressField, next: string) => {
      const name = fieldName(names, field);
      if (name) form.setValue(name, next, quiet);
    };
    // A level the new province or district does not have is dropped in the form too.
    if (value.district === null) set("district", "");
    if (value.neighbourhood === null) {
      set("neighbourhood", "");
      set("postalCode", "");
    } else if (value.postalCode !== null) {
      set("postalCode", value.postalCode);
    }
    return;
  }
  const picked =
    before.provinceCode !== value.provinceCode ||
    before.district !== value.district ||
    !sameName(before.neighbourhood, value.neighbourhood);
  const options: AddressFormWriteOptions = picked
    ? { shouldDirty: true, shouldTouch: true, shouldValidate }
    : { shouldDirty: false, shouldTouch: false, shouldValidate: false };

  const write = (field: AddressField, next: string | null) => {
    const name = fieldName(names, field);
    if (name) form.setValue(name, next ?? "", options);
  };
  if (picked) {
    write("province", value.province);
    write("provinceCode", value.provinceCode);
    write("district", value.district);
    write("neighbourhood", value.neighbourhood);
  }
  write("postalCode", value.postalCode);
}
