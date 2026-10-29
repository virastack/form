import { createElement, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { type AddressForm, type AddressFieldNames, fieldName, readForm, sameName, writeForm } from "../core/form.js";
import { compareNames, toSearchKey, formatName } from "../core/format.js";
import { matchPostalCode, normalizePostalCode, provinceCodeOf } from "../core/postal.js";
import { defaultSource } from "../core/source.js";
import type {
  AddressLevel,
  AddressNeighbourhood,
  AddressOption,
  AddressSource,
  AddressValue,
  NeighbourhoodOption,
} from "../core/types.js";

/** The `headless` flavour: what a select component needs, library-agnostic. */
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

/**
 * Which props to emit. `native` (the default) spreads onto a plain `<select>`;
 * `headless` gives `options` plus `onChange(value)` for your own component.
 */
export type AddressSelectFlavour = "native" | "headless" | "shadcn" | "antd";

export interface GetSelectPropsOptions {
  /** Defaults to `native`. */
  as?: AddressSelectFlavour;
  disabled?: boolean;
  placeholder?: string;
  name?: string;
  id?: string;
}

export interface GetPostalCodeInputPropsOptions {
  disabled?: boolean;
  placeholder?: string;
  name?: string;
  id?: string;
}

/**
 * What the last postal code matched. `exact`: one neighbourhood, every level
 * is filled. `partial`: province and district are filled and the
 * neighbourhood list is narrowed to the code, the user picks one. `unknown`:
 * not a code in the dataset, nothing changed.
 */
export type PostalCodeStatus = "loading" | "exact" | "partial" | "unknown";

export interface UseViraAddressOptions<P extends string = string> {
  /** Defaults to the bundled dataset. */
  source?: AddressSource;
  /** Where to start. With a `form`, defaults to the address the form holds. */
  defaultValue?: {
    provinceCode?: string | number | null;
    district?: string | null;
    neighbourhood?: string | null;
  };
  /** How a raw name becomes a label. Defaults to Turkish title case. */
  formatLabel?: (name: string, level: AddressLevel) => string;
  onChange?: (value: AddressValue) => void;
  /**
   * A form to keep in step, such as React Hook Form's `useForm()`. Every pick
   * is written into it, and a cleared level is cleared there too.
   */
  form?: AddressForm<P>;
  /**
   * Field names, in the form and on the inputs the prop getters return.
   * Defaults to `province`, `district`, `neighbourhood` and `postalCode`;
   * `provinceCode` is written only when named.
   */
  names?: AddressFieldNames<P>;
  /** Defaults to true: a cleared level revalidates the fields below it. */
  shouldValidate?: boolean;
}

export interface UseViraAddressReturn {
  value: AddressValue;
  provinces: readonly AddressOption[];
  districts: readonly AddressOption[];
  neighbourhoods: readonly NeighbourhoodOption[];
  setProvince: (code: string | number | null) => void;
  setDistrict: (name: string | null) => void;
  setNeighbourhood: (name: string | null) => void;
  /**
   * Fills the address from a postal code: every level when the code has one
   * neighbourhood, province and district otherwise. Null clears the lookup and
   * keeps the address. Resolves with what the code matched, or null when it
   * was cleared or the province failed to load.
   */
  setPostalCode: (code: string | number | null) => Promise<PostalCodeStatus | null>;
  /** What the last postal code matched; null when no lookup is active. */
  postalCodeStatus: PostalCodeStatus | null;
  reset: () => void;
  loading: { neighbourhoods: boolean };
  error: Error | null;
  getProvinceProps: (options?: GetSelectPropsOptions) => Record<string, unknown>;
  getDistrictProps: (options?: GetSelectPropsOptions) => Record<string, unknown>;
  getNeighbourhoodProps: (options?: GetSelectPropsOptions) => Record<string, unknown>;
  /** A hidden input keeps the derived postal code in an uncontrolled form. */
  getPostalCodeProps: () => Record<string, unknown>;
  /**
   * A text input the user can type a postal code into. It shows the derived
   * code after a pick and looks the code up once five digits are in.
   */
  getPostalCodeInputProps: (options?: GetPostalCodeInputPropsOptions) => Record<string, unknown>;
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
const filterBySearchKey = (input: string, option?: { label?: unknown }): boolean =>
  toSearchKey(String(option?.label ?? "")).includes(toSearchKey(input));

/** Pull a plain value out of whatever a select hands back. */
function readValue(next: unknown): string {
  if (typeof next === "string") return next;
  if (next == null) return "";
  if (typeof next === "number") return String(next);
  const target = (next as { target?: { value?: unknown } }).target;
  if (target && typeof target.value === "string") return target.value;
  return String(next);
}

export function useViraAddress<P extends string = string>(
  options: UseViraAddressOptions<P> = {},
): UseViraAddressReturn {
  const {
    source = defaultSource,
    formatLabel = formatName,
    onChange,
    names,
    defaultValue,
    form,
    shouldValidate = true,
  } = options;

  const autoId = useId();
  // Read once: an edit form's address is where the selects start.
  const [initial] = useState(() => defaultValue ?? (form ? readForm(form, names, source) : undefined));
  const [provinceCode, setProvinceCodeState] = useState<string | null>(
    initial?.provinceCode == null ? null : String(initial.provinceCode),
  );
  const [district, setDistrictState] = useState<string | null>(initial?.district ?? null);
  const [neighbourhood, setNeighbourhoodState] = useState<string | null>(initial?.neighbourhood ?? null);
  // Tagged with the province it belongs to, so a district name that exists in
  // two provinces ("MERKEZ") never shows the previous province's list.
  const [loaded, setLoaded] = useState<{
    code: number;
    byDistrict: ReadonlyMap<string, readonly AddressNeighbourhood[]>;
  } | null>(null);
  const [loadingNeighbourhoods, setLoadingNeighbourhoods] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // The postal code a lookup settled on. It narrows the neighbourhoods and is
  // the code reported, until a level higher up is picked by hand.
  const [postalPin, setPostalPin] = useState<string | null>(null);
  const [postalStatus, setPostalStatus] = useState<PostalCodeStatus | null>(null);
  // What the user is typing into the postal code input; null shows the derived code.
  const [postalDraft, setPostalDraft] = useState<string | null>(null);

  const provinceOptions = useMemo<readonly AddressOption[]>(
    () =>
      [...source.provinces]
        .sort((a, b) => compareNames(a.name, b.name))
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
            .sort(compareNames)
            .map((name) => ({ value: name, label: formatLabel(name, "district") }))
        : [],
    [province, formatLabel],
  );

  const activeCode = province?.code ?? null;
  const byDistrict = loaded && loaded.code === activeCode ? loaded.byDistrict : null;

  const neighbourhoodOptions = useMemo<readonly NeighbourhoodOption[]>(() => {
    if (!byDistrict || !district) return [];
    const list = byDistrict.get(district) ?? [];
    return (postalPin === null ? list : list.filter((n) => n.postalCodes.includes(postalPin))).map((n) => ({
      value: n.name,
      label: formatLabel(n.name, "neighbourhood"),
      postalCode: n.postalCode,
      postalCodes: n.postalCodes,
    }));
  }, [byDistrict, district, formatLabel, postalPin]);

  // Read at pick time, so an options object rebuilt on every render cannot
  // restart the load in a loop.
  const sourceRef = useRef(source);
  sourceRef.current = source;

  // A postal code lookup has already loaded the province it fills in.
  const loadedRef = useRef(loaded);
  loadedRef.current = loaded;

  // One request per province, and a stale response never lands on a newer pick.
  const requestRef = useRef(0);
  useEffect(() => {
    const ticket = ++requestRef.current;
    setError(null);
    if (activeCode == null || loadedRef.current?.code === activeCode) {
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
    // A name that came back from a database ("Aksaray Mah.") still finds its
    // neighbourhood, and the value carries the dataset's spelling from then on.
    const picked =
      neighbourhoodOptions.find((n) => n.value === neighbourhood) ??
      (neighbourhood === null
        ? undefined
        : neighbourhoodOptions.find((n) => toSearchKey(n.value) === toSearchKey(neighbourhood)));
    // A neighbourhood with several codes reports the one that was typed.
    const postalCode = picked
      ? postalPin !== null && picked.postalCodes.includes(postalPin)
        ? postalPin
        : picked.postalCode
      : postalPin;
    return {
      provinceCode,
      province: province?.name ?? null,
      district,
      neighbourhood: picked?.value ?? neighbourhood,
      postalCode,
      postalCodes: picked?.postalCodes ?? (postalCode === null ? [] : [postalCode]),
    };
  }, [provinceCode, province, district, neighbourhood, neighbourhoodOptions, postalPin]);

  // Report changes, not the first render, and compare by field: a caller that
  // rebuilds its options on every render must not look like a change.
  const reportRef = useRef({ onChange, form, names, shouldValidate });
  reportRef.current = { onChange, form, names, shouldValidate };
  const lastReported = useRef<AddressValue | null>(null);
  // Set when the levels were just taken from the form, so they are not written back as a pick.
  const fromFormRef = useRef(false);
  useEffect(() => {
    const previous = lastReported.current;
    const fromForm = fromFormRef.current;
    fromFormRef.current = false;
    lastReported.current = value;
    if (previous === null || sameAddress(previous, value)) return;
    const report = reportRef.current;
    if (report.form) writeForm(report.form, report.names, previous, value, report.shouldValidate, fromForm);
    report.onChange?.(value);
  }, [value]);

  // Follow the form when it changes the address itself: reset() with loaded
  // data, reset() to empty, or setValue() on a level. The hook's own writes land
  // here too and match what it holds, so they are ignored.
  const levelsRef = useRef({ provinceCode, district, neighbourhood });
  levelsRef.current = { provinceCode, district, neighbourhood };
  const watchedKey = (["province", "provinceCode", "district", "neighbourhood"] as const)
    .map((field) => fieldName(names, field) ?? "")
    .join("\u0000");
  // Keyed on subscribe itself: useFormContext() hands out a new object on every
  // render, and resubscribing then would drop a change still being read.
  const subscribe = form?.subscribe;
  useEffect(() => {
    if (!subscribe) return;
    const watched = watchedKey.split("\u0000").filter(Boolean) as P[];
    let active = true;
    const unsubscribe = subscribe.call(reportRef.current.form, {
      name: watched,
      formState: { values: true },
      callback: () => {
        // Read once React Hook Form has finished this change; reset() and the
        // hook's own writes set several fields one after another.
        queueMicrotask(() => {
          if (!active) return;
          const target = reportRef.current.form;
          if (!target) return;
          const next = readForm(target, reportRef.current.names, sourceRef.current);
          const code = next ? String(next.provinceCode) : null;
          const nextDistrict = next?.district ?? null;
          const nextNeighbourhood = next?.neighbourhood ?? null;
          const current = levelsRef.current;
          if (
            code === current.provinceCode &&
            sameName(nextDistrict, current.district) &&
            sameName(nextNeighbourhood, current.neighbourhood)
          ) {
            return;
          }
          fromFormRef.current = true;
          dropPostalCode();
          setProvinceCodeState(code);
          setDistrictState(nextDistrict);
          setNeighbourhoodState(nextNeighbourhood);
        });
      },
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [subscribe, watchedKey]);

  // Bumped by every pick, so a lookup still loading never lands on top of one.
  const lookupRef = useRef(0);

  // Forgets the postal code lookup, for a pick by hand higher up than the neighbourhood.
  const dropPostalCode = useCallback(() => {
    lookupRef.current++;
    setPostalPin(null);
    setPostalStatus(null);
    setPostalDraft(null);
  }, []);

  // Picking higher up clears everything below it.
  const setProvince = useCallback(
    (next: string | number | null) => {
      const code = next == null || next === "" ? null : String(next);
      dropPostalCode();
      setProvinceCodeState(code);
      setDistrictState(null);
      setNeighbourhoodState(null);
    },
    [dropPostalCode],
  );

  const setDistrict = useCallback(
    (next: string | null) => {
      dropPostalCode();
      setDistrictState(next === "" ? null : next);
      setNeighbourhoodState(null);
    },
    [dropPostalCode],
  );

  // The list is narrowed to the postal code, so a pick from it keeps the code.
  const setNeighbourhood = useCallback((next: string | null) => {
    lookupRef.current++;
    setNeighbourhoodState(next === "" ? null : next);
  }, []);

  const reset = useCallback(() => {
    dropPostalCode();
    setProvinceCodeState(null);
    setDistrictState(null);
    setNeighbourhoodState(null);
  }, [dropPostalCode]);

  const lookupPostalCode = useCallback(async (input: string | number | null): Promise<PostalCodeStatus | null> => {
    const ticket = ++lookupRef.current;
    const live = () => ticket === lookupRef.current;
    const code = normalizePostalCode(input);
    const fail = (status: PostalCodeStatus | null) => {
      setPostalPin(null);
      setPostalStatus(status);
      return status;
    };
    if (code === null) return fail(input == null || String(input).trim() === "" ? null : "unknown");

    const target = sourceRef.current.provinces.find((p) => p.code === provinceCodeOf(code));
    if (!target) return fail("unknown");

    setPostalStatus("loading");
    let byDistrict: ReadonlyMap<string, readonly AddressNeighbourhood[]>;
    try {
      byDistrict = await sourceRef.current.neighbourhoods(target.code);
    } catch (cause: unknown) {
      if (live()) {
        setError(cause instanceof Error ? cause : new Error(String(cause)));
        fail(null);
      }
      return null;
    }

    const hits = matchPostalCode(byDistrict, code);
    const hit = hits.length === 1 ? hits[0] : undefined;
    const status: PostalCodeStatus =
      hits.length === 0 ? "unknown" : hit && hit.neighbourhoods.length === 1 ? "exact" : "partial";
    if (!live()) return status;
    if (status === "unknown") return fail("unknown");

    // A neighbourhood already picked under this code is kept, not cleared.
    const current = levelsRef.current;
    const kept =
      hit && String(target.code) === current.provinceCode && hit.district === current.district
        ? (hit.neighbourhoods.find((n) => sameName(n.name, current.neighbourhood))?.name ?? null)
        : null;
    setLoaded({ code: target.code, byDistrict });
    setProvinceCodeState(String(target.code));
    // A code over two districts (a custom source's, never the bundled data) fills the province only.
    setDistrictState(hit?.district ?? null);
    setNeighbourhoodState(status === "exact" ? (hit?.neighbourhoods[0]?.name ?? null) : kept);
    setPostalPin(code);
    setPostalStatus(status);
    return status;
  }, []);

  const setPostalCode = useCallback(
    (next: string | number | null) => {
      setPostalDraft(null);
      return lookupPostalCode(next);
    },
    [lookupPostalCode],
  );

  const buildProps = useCallback(
    (
      level: AddressLevel,
      opts: GetSelectPropsOptions,
      state: { options: readonly AddressOption[]; value: string; set: (next: unknown) => void; blocked: boolean; busy: boolean },
    ): Record<string, unknown> => {
      const flavour = opts.as ?? "native";
      const base: AddressSelectProps = {
        name: opts.name ?? fieldName(names, level) ?? level,
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
        return { ...base, value: base.value || undefined, showSearch: true, optionFilterProp: "label", filterOption: filterBySearchKey };
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
        value: value.neighbourhood ?? "",
        set: (next) => setNeighbourhood(readValue(next)),
        blocked: !district || (neighbourhoodOptions.length === 0 && !loadingNeighbourhoods),
        busy: loadingNeighbourhoods && Boolean(district),
      }),
    [buildProps, neighbourhoodOptions, value.neighbourhood, setNeighbourhood, district, loadingNeighbourhoods],
  );

  const getPostalCodeProps = useCallback(
    () => ({
      type: "hidden" as const,
      name: fieldName(names, "postalCode") ?? "postalCode",
      value: value.postalCode ?? "",
      readOnly: true,
    }),
    [names, value.postalCode],
  );

  const getPostalCodeInputProps = useCallback(
    (opts: GetPostalCodeInputPropsOptions = {}) => ({
      type: "text" as const,
      inputMode: "numeric" as const,
      autoComplete: "postal-code",
      maxLength: 5,
      name: opts.name ?? fieldName(names, "postalCode") ?? "postalCode",
      id: opts.id ?? `${autoId}-postalCode`,
      value: postalDraft ?? value.postalCode ?? "",
      onChange: (next: unknown) => {
        const digits = readValue(next).replace(/\D/g, "").slice(0, 5);
        setPostalDraft(digits);
        // Five digits look the code up; fewer drop the last lookup but keep the address.
        if (digits.length === 5) void lookupPostalCode(digits);
        else void lookupPostalCode(null);
      },
      disabled: opts.disabled ?? false,
      placeholder: opts.placeholder ?? "Posta kodu",
      "aria-invalid": postalStatus === "unknown",
      "aria-busy": postalStatus === "loading",
    }),
    [names, autoId, postalDraft, value.postalCode, lookupPostalCode, postalStatus],
  );

  return {
    value,
    provinces: provinceOptions,
    districts: districtOptions,
    neighbourhoods: neighbourhoodOptions,
    setProvince,
    setDistrict,
    setNeighbourhood,
    setPostalCode,
    postalCodeStatus: postalStatus,
    reset,
    loading: { neighbourhoods: loadingNeighbourhoods },
    error,
    getProvinceProps,
    getDistrictProps,
    getNeighbourhoodProps,
    getPostalCodeProps,
    getPostalCodeInputProps,
  };
}
