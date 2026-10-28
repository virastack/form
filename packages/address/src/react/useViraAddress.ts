import { createElement, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { compareTr, foldTr, titleCaseTr } from "../core/format.js";
import { defaultSource } from "../core/source.js";
import type {
  AddressLevel,
  AddressNeighbourhood,
  AddressOption,
  AddressSource,
  AddressValue,
  NeighbourhoodOption,
} from "../core/types.js";

/** What a select needs, in the shape most libraries already accept. */
export interface AddressSelectProps<O extends AddressOption = AddressOption> {
  name: string;
  id: string;
  options: readonly O[];
  value: string;
  onChange: (next: unknown) => void;
  disabled: boolean;
  loading: boolean;
  "aria-busy": boolean;
  placeholder: string;
}

/** Which library's prop names to emit. The default is library-agnostic. */
export type AddressSelectFlavour = "headless" | "native" | "shadcn" | "antd";

export interface GetSelectPropsOptions {
  as?: AddressSelectFlavour;
  disabled?: boolean;
  placeholder?: string;
  name?: string;
  id?: string;
}

export interface UseViraAddressOptions {
  /** Defaults to the bundled dataset. */
  source?: AddressSource;
  defaultValue?: {
    provinceCode?: string | number | null;
    district?: string | null;
    neighbourhood?: string | null;
  };
  /** How a raw name becomes a label. Defaults to Turkish title case. */
  formatLabel?: (name: string, level: AddressLevel) => string;
  onChange?: (value: AddressValue) => void;
  names?: Partial<Record<AddressLevel | "postalCode", string>>;
}

export interface UseViraAddressReturn {
  value: AddressValue;
  provinces: readonly AddressOption[];
  districts: readonly AddressOption[];
  neighbourhoods: readonly NeighbourhoodOption[];
  setProvince: (code: string | number | null) => void;
  setDistrict: (name: string | null) => void;
  setNeighbourhood: (name: string | null) => void;
  reset: () => void;
  loading: { neighbourhoods: boolean };
  error: Error | null;
  getProvinceProps: (options?: GetSelectPropsOptions) => Record<string, unknown>;
  getDistrictProps: (options?: GetSelectPropsOptions) => Record<string, unknown>;
  getNeighbourhoodProps: (options?: GetSelectPropsOptions) => Record<string, unknown>;
  /** A hidden input keeps the derived postal code in an uncontrolled form. */
  getPostalCodeProps: () => Record<string, unknown>;
}

const PLACEHOLDERS: Record<AddressLevel, string> = {
  province: "İl seçiniz",
  district: "İlçe seçiniz",
  neighbourhood: "Mahalle seçiniz",
};

function sameAddress(a: AddressValue, b: AddressValue): boolean {
  return (
    a.provinceCode === b.provinceCode &&
    a.province === b.province &&
    a.district === b.district &&
    a.neighbourhood === b.neighbourhood &&
    a.postalCode === b.postalCode
  );
}

// antd's own filter lower-cases "İ" to "i̇", so "istanbul" would never match.
const filterTr = (input: string, option?: { label?: unknown }): boolean =>
  foldTr(String(option?.label ?? "")).includes(foldTr(input));

/** Pull a plain value out of whatever a select hands back. */
function readValue(next: unknown): string {
  if (typeof next === "string") return next;
  if (next == null) return "";
  if (typeof next === "number") return String(next);
  const target = (next as { target?: { value?: unknown } }).target;
  if (target && typeof target.value === "string") return target.value;
  return String(next);
}

export function useViraAddress(options: UseViraAddressOptions = {}): UseViraAddressReturn {
  const { source = defaultSource, formatLabel = titleCaseTr, onChange, names, defaultValue } = options;

  const autoId = useId();
  const [provinceCode, setProvinceCodeState] = useState<string | null>(
    defaultValue?.provinceCode == null ? null : String(defaultValue.provinceCode),
  );
  const [district, setDistrictState] = useState<string | null>(defaultValue?.district ?? null);
  const [neighbourhood, setNeighbourhoodState] = useState<string | null>(defaultValue?.neighbourhood ?? null);
  // Tagged with the province it belongs to, so a district name that exists in
  // two provinces ("MERKEZ") never shows the previous province's list.
  const [loaded, setLoaded] = useState<{
    code: number;
    byDistrict: ReadonlyMap<string, readonly AddressNeighbourhood[]>;
  } | null>(null);
  const [loadingNeighbourhoods, setLoadingNeighbourhoods] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const provinceOptions = useMemo<readonly AddressOption[]>(
    () =>
      [...source.provinces]
        .sort((a, b) => compareTr(a.name, b.name))
        .map((p) => ({ value: String(p.code), label: formatLabel(p.name, "province") })),
    [source, formatLabel],
  );

  const province = useMemo(
    () => source.provinces.find((p) => String(p.code) === provinceCode) ?? null,
    [source, provinceCode],
  );

  const districtOptions = useMemo<readonly AddressOption[]>(
    () =>
      province
        ? [...province.districts]
            .sort(compareTr)
            .map((name) => ({ value: name, label: formatLabel(name, "district") }))
        : [],
    [province, formatLabel],
  );

  const activeCode = province?.code ?? null;
  const byDistrict = loaded && loaded.code === activeCode ? loaded.byDistrict : null;

  const neighbourhoodOptions = useMemo<readonly NeighbourhoodOption[]>(() => {
    if (!byDistrict || !district) return [];
    return (byDistrict.get(district) ?? []).map((n) => ({
      value: n.name,
      label: formatLabel(n.name, "neighbourhood"),
      postalCode: n.postalCode,
      postalCodes: n.postalCodes,
    }));
  }, [byDistrict, district, formatLabel]);

  // Read at pick time, so an options object rebuilt on every render cannot
  // restart the load in a loop.
  const sourceRef = useRef(source);
  sourceRef.current = source;

  // One request per province, and a stale response never lands on a newer pick.
  const requestRef = useRef(0);
  useEffect(() => {
    const ticket = ++requestRef.current;
    setError(null);
    if (activeCode == null) {
      setLoadingNeighbourhoods(false);
      return;
    }
    setLoadingNeighbourhoods(true);
    sourceRef.current
      .neighbourhoods(activeCode)
      .then((map) => {
        if (ticket !== requestRef.current) return;
        setLoaded({ code: activeCode, byDistrict: map });
      })
      .catch((cause: unknown) => {
        if (ticket !== requestRef.current) return;
        setError(cause instanceof Error ? cause : new Error(String(cause)));
      })
      .finally(() => {
        if (ticket !== requestRef.current) return;
        setLoadingNeighbourhoods(false);
      });
  }, [activeCode]);

  const value = useMemo<AddressValue>(() => {
    const picked = neighbourhoodOptions.find((n) => n.value === neighbourhood);
    return {
      provinceCode,
      province: province?.name ?? null,
      district,
      neighbourhood,
      postalCode: picked?.postalCode ?? null,
      postalCodes: picked?.postalCodes ?? [],
    };
  }, [provinceCode, province, district, neighbourhood, neighbourhoodOptions]);

  // Report changes, not the first render, and compare by field: a caller that
  // rebuilds its options on every render must not look like a change.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastReported = useRef<AddressValue | null>(null);
  useEffect(() => {
    const previous = lastReported.current;
    lastReported.current = value;
    if (previous === null || sameAddress(previous, value)) return;
    onChangeRef.current?.(value);
  }, [value]);

  // Picking higher up clears everything below it.
  const setProvince = useCallback((next: string | number | null) => {
    const code = next == null || next === "" ? null : String(next);
    setProvinceCodeState(code);
    setDistrictState(null);
    setNeighbourhoodState(null);
  }, []);

  const setDistrict = useCallback((next: string | null) => {
    setDistrictState(next === "" ? null : next);
    setNeighbourhoodState(null);
  }, []);

  const setNeighbourhood = useCallback((next: string | null) => {
    setNeighbourhoodState(next === "" ? null : next);
  }, []);

  const reset = useCallback(() => {
    setProvinceCodeState(null);
    setDistrictState(null);
    setNeighbourhoodState(null);
  }, []);

  const buildProps = useCallback(
    (
      level: AddressLevel,
      opts: GetSelectPropsOptions,
      state: { options: readonly AddressOption[]; value: string; set: (next: unknown) => void; blocked: boolean; busy: boolean },
    ): Record<string, unknown> => {
      const flavour = opts.as ?? "headless";
      const base: AddressSelectProps = {
        name: opts.name ?? names?.[level] ?? level,
        id: opts.id ?? `${autoId}-${level}`,
        options: state.options,
        value: state.value,
        onChange: state.set,
        disabled: opts.disabled ?? (state.blocked || state.busy),
        loading: state.busy,
        "aria-busy": state.busy,
        placeholder: opts.placeholder ?? PLACEHOLDERS[level],
      };

      if (flavour === "shadcn") {
        const { onChange: handler, options: _options, loading: _loading, ...rest } = base;
        return { ...rest, onValueChange: handler };
      }
      if (flavour === "native") {
        // A native select takes its options as children; the empty first one
        // is the placeholder and lets the user clear the level again.
        const { options, loading: _loading, placeholder, ...rest } = base;
        return {
          ...rest,
          children: [
            createElement("option", { key: "", value: "" }, placeholder),
            ...options.map((o) => createElement("option", { key: o.value, value: o.value }, o.label)),
          ],
        };
      }
      if (flavour === "antd") {
        // antd shows the placeholder only while the value is undefined.
        return { ...base, value: base.value || undefined, showSearch: true, optionFilterProp: "label", filterOption: filterTr };
      }
      return base as unknown as Record<string, unknown>;
    },
    [autoId, names],
  );

  const getProvinceProps = useCallback(
    (opts: GetSelectPropsOptions = {}) =>
      buildProps("province", opts, {
        options: provinceOptions,
        value: provinceCode ?? "",
        set: (next) => setProvince(readValue(next)),
        blocked: false,
        busy: false,
      }),
    [buildProps, provinceOptions, provinceCode, setProvince],
  );

  const getDistrictProps = useCallback(
    (opts: GetSelectPropsOptions = {}) =>
      buildProps("district", opts, {
        options: districtOptions,
        value: district ?? "",
        set: (next) => setDistrict(readValue(next)),
        blocked: districtOptions.length === 0,
        busy: false,
      }),
    [buildProps, districtOptions, district, setDistrict],
  );

  const getNeighbourhoodProps = useCallback(
    (opts: GetSelectPropsOptions = {}) =>
      buildProps("neighbourhood", opts, {
        options: neighbourhoodOptions,
        value: neighbourhood ?? "",
        set: (next) => setNeighbourhood(readValue(next)),
        blocked: !district || (neighbourhoodOptions.length === 0 && !loadingNeighbourhoods),
        busy: loadingNeighbourhoods && Boolean(district),
      }),
    [buildProps, neighbourhoodOptions, neighbourhood, setNeighbourhood, district, loadingNeighbourhoods],
  );

  const getPostalCodeProps = useCallback(
    () => ({
      type: "hidden" as const,
      name: names?.postalCode ?? "postalCode",
      value: value.postalCode ?? "",
      readOnly: true,
    }),
    [names, value.postalCode],
  );

  return {
    value,
    provinces: provinceOptions,
    districts: districtOptions,
    neighbourhoods: neighbourhoodOptions,
    setProvince,
    setDistrict,
    setNeighbourhood,
    reset,
    loading: { neighbourhoods: loadingNeighbourhoods },
    error,
    getProvinceProps,
    getDistrictProps,
    getNeighbourhoodProps,
    getPostalCodeProps,
  };
}
