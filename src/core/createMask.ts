import {
  checkDate,
  correctDateDigits,
  dateLayout,
  digitsToParts,
  isoToDigits,
  limitToParts,
  partsToIso,
} from "./date";
import { warn } from "./dev";
import {
  canonicalNumber,
  editNumber,
  formatNumber,
  intlParts,
  parseLooseNumber,
  toNumberValue,
  type NumberFormatInfo,
} from "./number";
import { createPatternEngine } from "./pattern";
import {
  countryPresets,
  isPresetName,
  kindOf,
  presets,
  type Country,
  type CountryPresetName,
  type PresetKind,
  type PresetName,
} from "./presets";
import type {
  CurrencyConfig,
  DateConfig,
  ErrorKey,
  InputMode,
  Mask,
  MaskContext,
  MaskKind,
  MaskOptions,
  NumberConfig,
  OverridesOf,
  Preset,
  Validator,
} from "./types";

/** `phone` and `iban` take a `country` for a national layout and checks. */
type CountryOption<P extends PresetName> = P extends CountryPresetName ? { country?: Country } : { country?: never };

/** A preset with some of its options replaced. */
export type PresetWithOverrides =
  | { [P in PresetName]: { preset: P } & OverridesOf<PresetKind<P>> & CountryOption<P> }[PresetName]
  | { [K in MaskKind]: { preset: Preset<K> } & OverridesOf<K> & { country?: never } }[MaskKind];

/** Everything `createMask` accepts: a preset name, a preset, preset + overrides, or custom options. */
export type MaskSpec = PresetName | Preset | PresetWithOverrides | MaskOptions;

const EMPTY_CTX: MaskContext = {};

function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : String(value);
}

function runValidators(validators: readonly Validator[], value: string, ctx: MaskContext, name: string) {
  for (const validator of validators) {
    const result = validator(value, ctx);
    if (result === true) continue;
    return result === false ? (`${name}.invalid` as ErrorKey) : result;
  }
  return undefined;
}

function resolveSpec(spec: MaskSpec): { name: string; options: MaskOptions; validators: Validator[] } {
  if (typeof spec === "string") {
    if (isPresetName(spec)) return fromPreset(presets[spec]);
    warn(`Unknown preset "${spec}". The field is left unmasked.`);
    return { name: spec, options: { mask: passthrough }, validators: [] };
  }
  if ("preset" in spec && spec.preset !== undefined) {
    let preset: Preset | undefined = typeof spec.preset === "string" ? presets[spec.preset] : spec.preset;
    if (!preset) {
      warn(`Unknown preset "${String(spec.preset)}". The field is left unmasked.`);
      return { name: String(spec.preset), options: { mask: passthrough }, validators: [] };
    }
    const { preset: _preset, validate, country, ...overrides } = spec;
    if (country !== undefined) {
      const variant = countryPresets[preset.name as CountryPresetName]?.[country];
      if (variant) preset = variant;
      else warn(`"${preset.name}" has no "${String(country)}" layout. The global one is used.`);
    }
    const base = fromPreset(preset);
    const merged = mergeOptions(base.options, overrides);
    return { name: base.name, options: merged, validators: validate ? [...base.validators, validate] : base.validators };
  }
  if ("name" in spec && "kind" in spec && "options" in spec) return fromPreset(spec);
  const options = spec as MaskOptions;
  return { name: kindOf(options) === "pattern" ? "mask" : kindOf(options), options, validators: options.validate ? [options.validate] : [] };
}

function fromPreset(preset: Preset) {
  const options = preset.options as MaskOptions;
  return { name: preset.name, options, validators: options.validate ? [options.validate] : [] };
}

function mergeOptions(base: MaskOptions, overrides: Record<string, unknown>): MaskOptions {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue;
    const current = merged[key];
    if (key === "currency" && typeof value === "string") {
      merged[key] = { ...(typeof current === "object" ? current : {}), code: value };
    } else if (typeof value === "object" && typeof current === "object" && current !== null && !(value instanceof RegExp)) {
      merged[key] = { ...current, ...value };
    } else {
      merged[key] = value;
    }
  }
  return merged as unknown as MaskOptions;
}

const passthrough = "";

function textMask(name: string): Mask {
  return {
    name,
    kind: "pattern",
    usesFrom: false,
    inputProps: { inputMode: "text", type: "text" },
    format: toText,
    parse: (input) => input,
    validate: () => undefined,
    isComplete: (value) => value !== "",
    edit: ({ value, selectionStart }) => ({
      value,
      display: value,
      cursor: selectionStart ?? value.length,
      complete: value !== "",
    }),
    finalize: (value) => value,
  };
}

/**
 * Builds a pure, React-free mask. The same object formats, parses and validates
 * in the hook, on the server and in tests.
 *
 * @example
 * const tckn = createMask("tckn");
 * tckn.validate("12345678901"); // "tckn.invalid"
 */
export function createMask(spec: MaskSpec): Mask {
  const { name, options, validators } = resolveSpec(spec);
  if (options.mask === passthrough) return textMask(name);

  const input = {
    inputMode: options.inputMode,
    type: options.type ?? "text",
    autoComplete: options.autoComplete,
  };

  if (options.mask !== undefined) return patternMask(name, options, validators, input);
  if (options.number !== undefined) return numberMask(name, options.number, undefined, validators, input);
  if (options.currency !== undefined) {
    const config = typeof options.currency === "string" ? { code: options.currency } : options.currency;
    return numberMask(name, config, config, validators, input);
  }
  return dateMask(name, options.date ?? {}, validators, input);
}

interface InputDefaults {
  inputMode?: InputMode;
  type: "text" | "tel";
  autoComplete?: string;
}

function patternMask(
  name: string,
  options: Extract<MaskOptions, { mask: unknown }>,
  validators: readonly Validator[],
  input: InputDefaults,
): Mask {
  const engine = createPatternEngine(options);
  const { mask } = options;
  const digitsOnly =
    typeof mask !== "function" &&
    engine
      .candidates(EMPTY_CTX, "")
      .every((p) => p.slots.every((slot) => slot.type === "literal" || slot.test.source === "\\d"));

  return {
    name,
    kind: "pattern",
    usesFrom: typeof mask === "function" && mask.length > 1,
    inputProps: { inputMode: input.inputMode ?? (digitsOnly ? "numeric" : "text"), type: input.type, autoComplete: input.autoComplete },
    format: (value, ctx = EMPTY_CTX) => engine.parse(toText(value), ctx).display,
    parse: (text, ctx = EMPTY_CTX) => engine.parse(text, ctx).value,
    isComplete: (value, ctx = EMPTY_CTX) => engine.parse(value, ctx).complete,
    validate(value, ctx = EMPTY_CTX) {
      const text = toText(value);
      if (text === "") return undefined;
      const result = engine.parse(text, ctx);
      if (!result.complete) return `${name}.incomplete`;
      return runValidators(validators, result.value, ctx, name);
    },
    edit: (state, ctx = EMPTY_CTX) => engine.edit(state, ctx),
    finalize: (value) => value,
  };
}

function numberMask(
  name: string,
  config: NumberConfig | CurrencyConfig,
  currency: CurrencyConfig | undefined,
  validators: readonly Validator[],
  input: InputDefaults,
): Mask {
  const infoFor = (ctx: MaskContext): NumberFormatInfo => {
    let code: string | undefined;
    if (currency) {
      const linked = typeof ctx.from === "string" && /^[A-Za-z]{3}$/.test(ctx.from) ? ctx.from.toUpperCase() : undefined;
      code = linked ?? currency.code;
    }
    const locale = config.locale ?? (code === "TRY" ? "tr-TR" : "en-US");
    const parts = intlParts(locale, code);
    return {
      decimal: parts.decimal,
      group: parts.group,
      prefix: parts.prefix,
      suffix: parts.suffix,
      scale: config.scale ?? (code ? parts.digits : currency ? 2 : 0),
      signed: config.signed ?? false,
      min: config.min,
      max: config.max,
    };
  };

  const kind: MaskKind = currency ? "currency" : "number";

  return {
    name,
    kind,
    usesFrom: Boolean(currency),
    inputProps: {
      inputMode: input.inputMode ?? (config.scale === 0 || (!currency && !config.scale) ? "numeric" : "decimal"),
      type: input.type,
      autoComplete: input.autoComplete,
    },
    format(value, ctx = EMPTY_CTX) {
      const info = infoFor(ctx);
      return formatNumber(canonicalNumber(value, info), info);
    },
    parse(text, ctx = EMPTY_CTX) {
      return toNumberValue(parseLooseNumber(text, infoFor(ctx)));
    },
    isComplete: (value) => value !== "",
    validate(value, ctx = EMPTY_CTX) {
      const info = infoFor(ctx);
      const text = toNumberValue(canonicalNumber(value, { ...info, max: undefined }));
      if (text === "") return undefined;
      const number = Number(text);
      if (Number.isNaN(number)) return `${name}.invalid`;
      if (config.min !== undefined && number < config.min) return `${name}.min`;
      if (config.max !== undefined && number > config.max) return `${name}.max`;
      return runValidators(validators, text, ctx, name);
    },
    edit: (state, ctx = EMPTY_CTX) => editNumber(state, infoFor(ctx)),
    finalize(value, ctx = EMPTY_CTX) {
      if (value === "") return value;
      const info = infoFor(ctx);
      let next = value;
      if (config.min !== undefined && Number(next) < config.min) next = String(config.min);
      if (currency && next.includes(".") && info.scale > 0) {
        const [int, frac = ""] = next.split(".");
        next = `${int}.${frac.padEnd(info.scale, "0")}`;
      }
      return next;
    },
  };
}

function dateMask(name: string, config: DateConfig, validators: readonly Validator[], input: InputDefaults): Mask {
  const layout = dateLayout(config.format ?? "DD/MM/YYYY");
  const engine = createPatternEngine({
    mask: layout.pattern,
    eager: true,
    normalize: (value) => correctDateDigits(value.replace(/\D/g, ""), layout),
  });

  /** Raw digits in display order → form value (ISO once complete for full dates). */
  const toValue = (digits: string) => {
    if (!layout.full) return digits;
    const parts = digitsToParts(digits, layout);
    return parts ? partsToIso(parts) : digits;
  };
  /** Form value or any text → digits in display order. */
  const toDigits = (text: string) => isoToDigits(text.trim(), layout) ?? text;

  return {
    name,
    kind: "date",
    usesFrom: true,
    inputProps: { inputMode: input.inputMode ?? "numeric", type: input.type, autoComplete: input.autoComplete },
    format(value) {
      const parts = value instanceof Date ? limitToParts(value) : undefined;
      const text = parts ? partsToIso(parts) : toText(value);
      return engine.parse(toDigits(text), EMPTY_CTX).display;
    },
    parse: (text) => toValue(engine.parse(toDigits(text), EMPTY_CTX).value),
    isComplete: (value) => engine.parse(toDigits(value), EMPTY_CTX).complete,
    validate(value, ctx = EMPTY_CTX) {
      const text = toText(value);
      if (text === "") return undefined;
      const digits = engine.parse(toDigits(text), EMPTY_CTX).value;
      const error = checkDate(digits, layout, config, ctx.from);
      if (error) return `${name}.${error}`;
      return runValidators(validators, toValue(digits), ctx, name);
    },
    edit(state) {
      const result = engine.edit(state, EMPTY_CTX);
      return { ...result, value: toValue(result.value) };
    },
    finalize: (value) => value,
  };
}
