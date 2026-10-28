import { useCallback, useRef, useState } from "react";
import {
  type FieldValues,
  type Path,
  type PathValue,
  type UseFormGetValues,
  type UseFormSetValue,
  useFormContext,
} from "react-hook-form";

import { foldTr } from "./core/format.js";
import { defaultSource } from "./core/source.js";
import type { AddressSource, AddressValue } from "./core/types.js";
import { useViraAddress, type UseViraAddressOptions, type UseViraAddressReturn } from "./react/useViraAddress.js";

export interface ViraAddressFieldNames<T extends FieldValues> {
  province: Path<T>;
  district: Path<T>;
  neighbourhood: Path<T>;
  postalCode?: Path<T>;
  /** Store the plate code too, when the backend wants a stable key. */
  provinceCode?: Path<T>;
}

export interface UseViraAddressFieldOptions<T extends FieldValues> extends UseViraAddressOptions {
  names: ViraAddressFieldNames<T>;
  /** Only needed outside a FormProvider. */
  setValue?: UseFormSetValue<T>;
  /** Defaults to true: a cleared level revalidates the fields below it. */
  shouldValidate?: boolean;
}

export type UseViraAddressFieldReturn = UseViraAddressReturn;

/**
 * The address a form already holds, as a starting point for the hook. Names
 * are matched however they were cased, since they often come back from a
 * database rather than from this hook.
 */
function readForm<T extends FieldValues>(
  getValues: UseFormGetValues<T>,
  names: ViraAddressFieldNames<T>,
  source: AddressSource,
): UseViraAddressOptions["defaultValue"] {
  const read = (path: Path<T> | undefined): string | null => {
    const raw: unknown = path ? getValues(path) : null;
    return raw == null || raw === "" ? null : String(raw);
  };
  const code = read(names.provinceCode);
  const name = read(names.province);
  const province =
    code !== null
      ? source.provinces.find((p) => String(p.code) === String(Number(code)))
      : name !== null
        ? source.provinces.find((p) => foldTr(p.name) === foldTr(name))
        : undefined;
  if (!province) return undefined;

  const district = read(names.district);
  return {
    provinceCode: province.code,
    district: province.districts.find((d) => district !== null && foldTr(d) === foldTr(district)) ?? null,
    neighbourhood: read(names.neighbourhood),
  };
}

/**
 * Mirrors the address selection into React Hook Form. Picking a province
 * clears the district and neighbourhood in the form, not just in the hook.
 *
 * Inside a FormProvider nothing else is needed, and an address already in the
 * form's values is picked up; otherwise pass setValue and defaultValue.
 */
export function useViraAddressField<T extends FieldValues>(
  options: UseViraAddressFieldOptions<T>,
): UseViraAddressFieldReturn {
  const { names, setValue, shouldValidate = true, onChange, defaultValue, ...rest } = options;
  // useFormContext returns null outside a provider, which is a supported setup here.
  const context = useFormContext<T>();
  const write = setValue ?? context?.setValue;

  if (!write) {
    throw new Error(
      "useViraAddressField needs React Hook Form: render it inside a FormProvider, or pass setValue.",
    );
  }

  const [initial] = useState(
    () => defaultValue ?? (context ? readForm(context.getValues, names, rest.source ?? defaultSource) : undefined),
  );

  const previous = useRef<AddressValue | null>(null);

  const report = useCallback(
    (value: AddressValue) => {
      const before = previous.current;
      previous.current = value;

      // Only the postal code moved: the neighbourhoods arrived for an address
      // the form already held. That is not an edit, so the form stays pristine.
      const picked =
        before === null ||
        before.provinceCode !== value.provinceCode ||
        before.district !== value.district ||
        before.neighbourhood !== value.neighbourhood;
      const flags = picked
        ? { shouldDirty: true, shouldTouch: true, shouldValidate }
        : { shouldDirty: false, shouldTouch: false, shouldValidate: false };

      const apply = (path: Path<T> | undefined, next: string | null) => {
        if (!path) return;
        write(path, (next ?? "") as PathValue<T, Path<T>>, flags);
      };
      if (picked) {
        apply(names.province, value.province);
        apply(names.provinceCode, value.provinceCode);
        apply(names.district, value.district);
        apply(names.neighbourhood, value.neighbourhood);
      }
      apply(names.postalCode, value.postalCode);
      onChange?.(value);
    },
    [write, names, onChange, shouldValidate],
  );

  const address = useViraAddress({ ...rest, defaultValue: initial, onChange: report });
  // The hook does not report its first render; remember it as the baseline.
  previous.current ??= address.value;
  return address;
}
