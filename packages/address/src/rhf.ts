import { useCallback } from "react";
import { type FieldValues, type Path, type PathValue, type UseFormSetValue, useFormContext } from "react-hook-form";

import type { AddressValue } from "./core/types.js";
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
 * Mirrors the address selection into React Hook Form. Picking a province
 * clears the district and neighbourhood in the form, not just in the hook.
 *
 * Inside a FormProvider nothing else is needed; otherwise pass setValue.
 */
export function useViraAddressField<T extends FieldValues>(
  options: UseViraAddressFieldOptions<T>,
): UseViraAddressFieldReturn {
  const { names, setValue, shouldValidate = true, onChange, ...rest } = options;
  // useFormContext returns null outside a provider, which is a supported setup here.
  const context = useFormContext<T>();
  const write = setValue ?? context?.setValue;

  if (!write) {
    throw new Error(
      "useViraAddressField needs React Hook Form: render it inside a FormProvider, or pass setValue.",
    );
  }

  const report = useCallback(
    (value: AddressValue) => {
      const apply = (path: Path<T> | undefined, next: string | null) => {
        if (!path) return;
        write(path, (next ?? "") as PathValue<T, Path<T>>, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate,
        });
      };
      apply(names.province, value.province);
      apply(names.provinceCode, value.provinceCode);
      apply(names.district, value.district);
      apply(names.neighbourhood, value.neighbourhood);
      apply(names.postalCode, value.postalCode);
      onChange?.(value);
    },
    [write, names, onChange, shouldValidate],
  );

  return useViraAddress({ ...rest, onChange: report });
}
