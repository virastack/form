import { createMask, type MaskSpec, type PresetWithOverrides } from "./createMask";
import type { PresetName } from "./presets";
import type { Mask, MaskOptions, Preset } from "./types";

export type MaskOutput = "raw" | "masked";

/** Field-level options that sit next to the mask options in a schema entry. */
export interface FieldBehavior<TName extends string = string, TRules = unknown> {
  /** Form field path, when it differs from the schema key (`address.zip`). */
  name?: TName;
  /** Another form field this mask reads (`cvv` from `card`, `endDate` from `startDate`). */
  from?: TName;
  /** React Hook Form register rules (`required`, `deps`, `setValueAs`, `disabled`...). */
  rules?: TRules;
  /** Write the raw value (default) or the masked text into the form. */
  output?: MaskOutput;
  /** Called when the user completes the mask. */
  onComplete?: (value: string) => void;
}

export type FieldConfig<TName extends string = string, TRules = unknown> =
  | PresetName
  | Preset
  | (FieldBehavior<TName, TRules> & (PresetWithOverrides | MaskOptions));

export type MaskSchema<TName extends string = string, TRules = unknown> = Readonly<
  Record<string, FieldConfig<TName, TRules>>
>;

export interface ResolvedField {
  key: string;
  name: string;
  from?: string;
  output: MaskOutput;
  rules?: unknown;
  onComplete?: (value: string) => void;
  mask: Mask;
}

export function resolveField(key: string, config: FieldConfig): ResolvedField {
  if (typeof config === "string" || isPreset(config)) {
    return { key, name: key, output: "raw", mask: createMask(config) };
  }
  const { name, from, rules, output, onComplete, ...spec } = config;
  return {
    key,
    name: name ?? key,
    from,
    output: output ?? "raw",
    rules,
    onComplete,
    mask: createMask(spec as MaskSpec),
  };
}

export function resolveSchema(schema: MaskSchema): ResolvedField[] {
  return Object.keys(schema).map((key) => resolveField(key, schema[key]));
}

function isPreset(value: object): value is Preset {
  return "kind" in value && "options" in value && "name" in value && !("preset" in value);
}

/** The value a field stores in the form for its output mode. */
export function toOutput(field: ResolvedField, value: string, ctx: { from?: unknown }): string {
  return field.output === "masked" ? field.mask.format(value, ctx) : value;
}
