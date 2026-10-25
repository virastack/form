import { diffText, isForwardDelete } from "./diff";
import type { EditInput, EditResult, MaskContext, PatternConfig, TokenDefinition } from "./types";

interface InputSlot {
  type: "input";
  test: RegExp;
  transform?: (char: string) => string;
  optional: boolean;
}

interface LiteralSlot {
  type: "literal";
  char: string;
  /** Fixed literals are part of the value (`{TR}`), plain ones are display only. */
  fixed: boolean;
  optional: boolean;
}

type Slot = InputSlot | LiteralSlot;

export interface CompiledPattern {
  source: string;
  slots: readonly Slot[];
  required: number;
}

export interface ConformResult {
  value: string;
  display: string;
  /** `marks[k]` is the display length after the first `k` value characters. */
  marks: number[];
  /** `fixed[k]` is true when value character `k` comes from a `{fixed}` part. */
  fixed: boolean[];
  complete: boolean;
}

export const DEFAULT_TOKENS: Readonly<Record<string, TokenDefinition>> = {
  "9": /\d/,
  a: /\p{L}/u,
  "*": /[\p{L}\d]/u,
};

const cache = new WeakMap<Readonly<Record<string, TokenDefinition>>, Map<string, CompiledPattern>>();

export function compilePattern(
  source: string,
  tokens: Readonly<Record<string, TokenDefinition>> = DEFAULT_TOKENS,
): CompiledPattern {
  let byTokens = cache.get(tokens);
  if (!byTokens) {
    byTokens = new Map();
    cache.set(tokens, byTokens);
  }
  const hit = byTokens.get(source);
  if (hit) return hit;

  const slots: Slot[] = [];
  let optionalDepth = 0;
  let fixed = false;
  let required = 0;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    const optional = optionalDepth > 0;

    if (char === "\\" && i + 1 < source.length) {
      i++;
      slots.push({ type: "literal", char: source[i], fixed, optional });
      continue;
    }
    if (char === "[") {
      optionalDepth++;
      continue;
    }
    if (char === "]" && optionalDepth > 0) {
      optionalDepth--;
      continue;
    }
    if (char === "{") {
      fixed = true;
      continue;
    }
    if (char === "}" && fixed) {
      fixed = false;
      continue;
    }

    const token = fixed ? undefined : tokens[char];
    if (token) {
      const def = token instanceof RegExp ? { pattern: token } : token;
      slots.push({ type: "input", test: def.pattern, transform: def.transform, optional });
      if (!optional) required++;
    } else {
      slots.push({ type: "literal", char, fixed, optional });
    }
  }

  const compiled: CompiledPattern = { source, slots, required };
  byTokens.set(source, compiled);
  return compiled;
}

function matches(slot: InputSlot, char: string): boolean {
  slot.test.lastIndex = 0;
  return slot.test.test(char);
}

/** Places raw characters into the slots. Literals appear only once a character follows them. */
export function conform(
  raw: string,
  pattern: CompiledPattern,
  options: { transform?: PatternConfig["transform"]; eager?: boolean } = {},
): ConformResult {
  let value = "";
  let display = "";
  const marks = [0];
  const fixedFlags: boolean[] = [];
  let pending: LiteralSlot[] = [];
  let filled = 0;
  let index = 0;
  let slotIndex = 0;

  const { slots } = pattern;

  for (; slotIndex < slots.length; slotIndex++) {
    const slot = slots[slotIndex];
    if (index >= raw.length) break;

    if (slot.type === "literal") {
      if (slot.fixed && raw[index] === slot.char) index++;
      pending.push(slot);
      continue;
    }

    while (index < raw.length && !matches(slot, raw[index])) {
      if (slot.optional) break;
      index++;
    }
    if (index >= raw.length) break;
    if (!matches(slot, raw[index])) continue;

    for (const literal of pending) {
      display += literal.char;
      if (literal.fixed) {
        value += literal.char;
        marks.push(display.length);
        fixedFlags.push(true);
      }
    }
    pending = [];

    let char = raw[index++];
    if (slot.transform) char = slot.transform(char);
    if (options.transform === "uppercase") char = char.toUpperCase();
    else if (options.transform === "lowercase") char = char.toLowerCase();

    display += char;
    value += char;
    marks.push(display.length);
    fixedFlags.push(false);
    if (!slot.optional) filled++;
  }

  if (options.eager && value && pending.length === 0) {
    for (let next = slotIndex; next < slots.length; next++) {
      const slot = slots[next];
      if (slot.type !== "literal" || slot.fixed || slot.optional) break;
      display += slot.char;
    }
  }

  return { value, display, marks, fixed: fixedFlags, complete: filled === pattern.required };
}

/** Keeps only the characters that some slot in the pattern can accept. */
export function acceptable(text: string, patterns: readonly CompiledPattern[]): string {
  let out = "";
  for (const char of text) {
    const ok = patterns.some((pattern) =>
      pattern.slots.some((slot) => slot.type === "input" && matches(slot, char)),
    );
    if (ok) out += char;
  }
  return out;
}

export interface PatternEngine {
  resolve(value: string, ctx: MaskContext): CompiledPattern;
  candidates(ctx: MaskContext, value: string): readonly CompiledPattern[];
  normalize(value: string): string;
  conform(value: string, ctx: MaskContext): ConformResult;
  parse(input: string, ctx: MaskContext): ConformResult;
  edit(input: EditInput, ctx: MaskContext): EditResult;
}

export function createPatternEngine(config: PatternConfig): PatternEngine {
  const tokens = config.tokens ? { ...DEFAULT_TOKENS, ...config.tokens } : DEFAULT_TOKENS;
  const { mask } = config;
  const list = typeof mask === "string" ? [mask] : typeof mask === "function" ? null : mask;
  const compiledList = list?.map((source) => compilePattern(source, tokens));
  const conformOptions = { transform: config.transform, eager: config.eager };

  const normalize = (value: string) => (config.normalize ? config.normalize(value) : value);

  const resolve = (value: string, ctx: MaskContext): CompiledPattern => {
    if (typeof mask === "function") return compilePattern(mask(value, ctx), tokens);
    const all = compiledList ?? [];
    if (all.length === 1) return all[0];
    // Pick the first pattern that keeps every character of the value.
    for (const pattern of all) {
      const result = conform(value, pattern, conformOptions);
      if (acceptable(value, [pattern]).length <= result.value.length - result.fixed.filter(Boolean).length) {
        return pattern;
      }
    }
    return all[all.length - 1];
  };

  const candidates = (ctx: MaskContext, value: string): readonly CompiledPattern[] =>
    compiledList ?? [resolve(value, ctx)];

  const run = (value: string, ctx: MaskContext): ConformResult => {
    const normalized = normalize(value);
    return conform(normalized, resolve(normalized, ctx), conformOptions);
  };

  const parse = (input: string, ctx: MaskContext): ConformResult => {
    const pool = candidates(ctx, input);
    // Fixed characters (like `TR` or `+`) are re-inserted by conform, so only token characters matter.
    return run(acceptable(input, pool), ctx);
  };

  const edit = (input: EditInput, ctx: MaskContext): EditResult => {
    const { previous, value: next, selectionStart, inputType } = input;
    const prev = parse(previous, ctx);

    let before: string;
    let inserted: string;
    let after: string;

    if (prev.display !== previous) {
      // The DOM changed behind our back (autofill, programmatic write): parse it from scratch.
      const caret = selectionStart ?? next.length;
      before = "";
      inserted = next.slice(0, caret);
      after = next.slice(caret);
      const pool = candidates(ctx, next);
      inserted = acceptable(inserted, pool);
      after = acceptable(after, pool);
    } else {
      const change = diffText(previous, next, selectionStart);
      const countBefore = (pos: number) => {
        let count = 0;
        while (count + 1 < prev.marks.length && prev.marks[count + 1] <= pos) count++;
        return count;
      };
      let from = countBefore(change.start);
      let to = countBefore(change.removedEnd);

      const removedOnlyLiterals =
        change.inserted === "" &&
        change.removedEnd > change.start &&
        prev.fixed.slice(from, to).every(Boolean);

      if (removedOnlyLiterals) {
        // Deleting a separator alone would be undone by formatting; delete the neighbour instead.
        if (isForwardDelete(inputType)) {
          while (to < prev.fixed.length && prev.fixed[to]) to++;
          to = Math.min(prev.value.length, to + 1);
        } else {
          while (from > 0 && prev.fixed[from - 1]) from--;
          from = Math.max(0, from - 1);
        }
      }

      before = prev.value.slice(0, from);
      after = prev.value.slice(to);
      inserted = acceptable(change.inserted, candidates(ctx, prev.value + change.inserted));
    }

    const result = run(before + inserted + after, ctx);
    const head = run(before + inserted, ctx);
    const count = Math.min(head.value.length, result.value.length);
    const cursor = count >= result.value.length ? result.display.length : result.marks[count];

    return { value: result.value, display: result.display, cursor, complete: result.complete };
  };

  return { resolve, candidates, normalize, conform: run, parse, edit };
}
