import type { FieldErrors, FieldValues, Resolver, ResolverResult } from "react-hook-form";
import { getPath, setPath } from "../core/path";
import { resolveSchema, type MaskSchema } from "../core/schema";
import { isStandardSchema, issuePath, type StandardSchemaV1 } from "../core/standard-schema";

const TAG = Symbol.for("@virastack/mask/resolver");

export function isMaskResolver(value: unknown): boolean {
  return typeof value === "function" && TAG in value;
}

/**
 * React Hook Form skips `register` validation when a resolver is set.
 * Wrap the resolver (or pass a Standard Schema such as a Zod schema) so mask errors still show up.
 *
 * @example
 * useForm({ resolver: maskResolver(masks, zodResolver(schema)) })
 * useForm({ resolver: maskResolver(masks, schema) }) // Standard Schema, no @hookform/resolvers needed
 */
export function maskResolver<V extends StandardSchemaV1>(
  schema: MaskSchema,
  base: V,
): Resolver<
  StandardSchemaV1.InferInput<V> extends FieldValues ? StandardSchemaV1.InferInput<V> : FieldValues,
  unknown,
  StandardSchemaV1.InferOutput<V>
>;
export function maskResolver<T extends FieldValues = FieldValues, C = unknown, TT = T>(
  schema: MaskSchema,
  base?: Resolver<T, C, TT>,
): Resolver<T, C, TT>;
export function maskResolver(
  schema: MaskSchema,
  base?: Resolver<FieldValues, unknown, unknown> | StandardSchemaV1,
): Resolver<FieldValues, unknown, unknown> {
  const fields = resolveSchema(schema);

  const resolver: Resolver<FieldValues, unknown, unknown> = async (values, context, options) => {
    let result: ResolverResult<FieldValues, unknown>;
    if (typeof base === "function") {
      result = await base(values, context, options);
    } else if (isStandardSchema(base)) {
      const outcome = await base["~standard"].validate(values);
      if (outcome.issues) {
        const errors: Record<string, unknown> = {};
        for (const issue of outcome.issues) {
          const path = issuePath(issue);
          if (!getPath(errors, path)) setPath(errors, path, { type: "validate", message: issue.message });
        }
        result = { values: {}, errors: errors as FieldErrors<FieldValues> };
      } else {
        result = { values: outcome.value, errors: {} };
      }
    } else {
      result = { values, errors: {} };
    }

    const errors = { ...result.errors } as Record<string, unknown>;
    let failed = false;
    for (const field of fields) {
      if (getPath(errors, field.name)) continue;
      const ctx = { from: field.from ? getPath(values, field.from) : undefined };
      const error = field.mask.validate(getPath(values, field.name), ctx);
      if (error) {
        setPath(errors, field.name, { type: "mask", message: error });
        failed = true;
      }
    }

    return failed ? { values: {}, errors: errors as FieldErrors<FieldValues> } : result;
  };

  return Object.assign(resolver, { [TAG]: true });
}
