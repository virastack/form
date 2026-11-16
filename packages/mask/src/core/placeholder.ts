import { resolveSpec, type MaskSpec } from "./createMask";
import { createPatternEngine } from "./pattern";

/**
 * Placeholder text for a pattern mask: `_` for every character to type, the mask's own
 * separators as they are. Optional parts are left out, and a mask that picks its pattern
 * at runtime is read as it is for an empty field. Number, currency and date masks
 * return `undefined`, and so does a mask with at most one required character
 * (free text such as `fullName`), where a placeholder would say nothing.
 *
 * @example
 * getMaskPlaceholder({ preset: "phone", country: "TR" }); // "(___) ___ __ __"
 */
export function getMaskPlaceholder(spec: MaskSpec): string | undefined {
  const { options } = resolveSpec(spec);
  // Number, currency and date masks have no pattern; an unknown preset resolves to an empty one.
  const pattern = options.mask ? createPatternEngine(options).candidates({}, "")[0] : undefined;
  const text = pattern?.slots.map((slot) => (slot.optional ? "" : slot.type === "input" ? "_" : slot.char)).join("");
  return text && text.length > 1 ? text : undefined;
}
