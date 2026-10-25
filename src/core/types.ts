/** Error keys look like `tckn.invalid` or `date.min`. Map them to messages in your own i18n layer. */
export type ErrorKey = `${string}.${string}`;

/** Runtime context passed to a mask. `from` is the current value of the linked field. */
export interface MaskContext {
  from?: unknown;
}

export type InputMode = "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url" | "none";

export type MaskKind = "pattern" | "number" | "currency" | "date";

/** A custom validator. Return `true` when valid, `false` for `<name>.invalid`, or your own error key. */
export type Validator = (value: string, ctx: MaskContext) => boolean | ErrorKey;

/** A token in a pattern. A RegExp tests one character; the object form can also transform it. */
export type TokenDefinition = RegExp | { pattern: RegExp; transform?: (char: string) => string };

/** Picks the pattern from the current value (and the linked field's value as `ctx.from`). */
export type PatternResolver = (value: string, ctx: MaskContext) => string;

export interface InputOptions {
  /** Extra validation that runs after the built-in checks. */
  validate?: Validator;
  inputMode?: InputMode;
  autoComplete?: string;
  type?: "text" | "tel";
}

export interface PatternConfig {
  /**
   * `9` digit, `a` letter, `*` letter or digit.
   * `\` escapes the next character, `[...]` marks an optional part,
   * `{...}` is a fixed part that is also kept in the value.
   * An array picks the first pattern that fits the value; a function picks one at runtime.
   */
  mask: string | readonly string[] | PatternResolver;
  tokens?: Readonly<Record<string, TokenDefinition>>;
  transform?: "uppercase" | "lowercase";
  /** Rewrites the value before it is placed into the pattern (e.g. strip a leading `0`). */
  normalize?: (value: string) => string;
  /** Show the literals that follow the last typed character right away (`02` → `02/`). */
  eager?: boolean;
}

export interface NumberConfig {
  /** BCP 47 locale for separators. Default `tr-TR`. */
  locale?: string;
  min?: number;
  max?: number;
  /** Maximum fraction digits. Default `0`. */
  scale?: number;
  /** Allow negative numbers. Default `false`. */
  signed?: boolean;
}

export interface CurrencyConfig {
  /** ISO 4217 code. Default `TRY`. A linked field (`from`) holding a code overrides it. */
  code?: string;
  /** BCP 47 locale. Default `tr-TR` for TRY, `en-US` otherwise. */
  locale?: string;
  min?: number;
  max?: number;
  /** Fraction digits. Defaults to the currency's own (2 for TRY, 0 for JPY). */
  scale?: number;
  signed?: boolean;
}

export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | "DD.MM.YYYY" | "MM/YY" | "MM/YYYY";

/** `today`, an ISO date (`2026-01-31`) or a `Date`. */
export type DateLimit = "today" | (string & {}) | Date;

export interface DateConfig {
  /** Default `DD/MM/YYYY`. */
  format?: DateFormat;
  min?: DateLimit;
  max?: DateLimit;
  /** Minimum age in years, for birth dates. */
  minAge?: number;
}

type Exclusive<T, K extends PropertyKey> = T & { [P in Exclude<K, keyof T>]?: never };

type KindKeys = "mask" | "tokens" | "transform" | "normalize" | "eager" | "number" | "currency" | "date";

type Custom<T> = Exclusive<T, KindKeys> & { preset?: never; country?: never };

export type PatternMaskOptions = Custom<InputOptions & PatternConfig>;
export type NumberMaskOptions = Custom<InputOptions & { number: NumberConfig }>;
export type CurrencyMaskOptions = Custom<InputOptions & { currency: CurrencyConfig | string }>;
export type DateMaskOptions = Custom<InputOptions & { date: DateConfig }>;

/** Options for a custom mask. Exactly one of `mask`, `number`, `currency` or `date`. */
export type MaskOptions = PatternMaskOptions | NumberMaskOptions | CurrencyMaskOptions | DateMaskOptions;

export type OptionsOfKind<K extends MaskKind> = K extends "pattern"
  ? PatternMaskOptions
  : K extends "number"
    ? NumberMaskOptions
    : K extends "currency"
      ? CurrencyMaskOptions
      : DateMaskOptions;

/** What can be changed on top of a preset of a given kind. */
export type OverridesOf<K extends MaskKind> = K extends "pattern"
  ? Exclusive<InputOptions & { transform?: "uppercase" | "lowercase" }, KindKeys>
  : K extends "number"
    ? Exclusive<InputOptions & { number?: NumberConfig }, KindKeys>
    : K extends "currency"
      ? Exclusive<InputOptions & { currency?: CurrencyConfig | string }, KindKeys>
      : Exclusive<InputOptions & { date?: DateConfig }, KindKeys>;

export interface Preset<K extends MaskKind = MaskKind> {
  readonly name: string;
  readonly kind: K;
  readonly options: OptionsOfKind<K>;
}

export interface EditInput {
  /** The display value before the edit. */
  previous: string;
  /** The display value after the browser applied the edit. */
  value: string;
  /** Caret position after the edit. */
  selectionStart: number | null;
  /** `InputEvent.inputType`, used to tell Backspace from Delete. */
  inputType?: string;
}

export interface EditResult {
  /** Form value (raw). */
  value: string;
  display: string;
  cursor: number;
  complete: boolean;
}

export interface Mask {
  readonly name: string;
  readonly kind: MaskKind;
  /** Whether the mask reads `ctx.from`. */
  readonly usesFrom: boolean;
  readonly inputProps: { inputMode: InputMode; type: "text" | "tel"; autoComplete?: string };
  /** Raw value → display text. */
  format(value: unknown, ctx?: MaskContext): string;
  /** Any text (masked, pasted, raw) → raw value. */
  parse(input: string, ctx?: MaskContext): string;
  /** `undefined` when valid or empty, otherwise an error key. */
  validate(value: unknown, ctx?: MaskContext): ErrorKey | undefined;
  isComplete(value: string, ctx?: MaskContext): boolean;
  /** Applies one input event: returns the new value, display and caret. */
  edit(input: EditInput, ctx?: MaskContext): EditResult;
  /** Final touches on blur (e.g. clamp to `min`). */
  finalize(value: string, ctx?: MaskContext): string;
}
