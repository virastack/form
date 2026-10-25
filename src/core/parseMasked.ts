import { getPath, setPath } from "./path";
import { resolveSchema, toOutput, type MaskSchema, type ResolvedField } from "./schema";
import { issuePath, type StandardSchemaV1 } from "./standard-schema";

/** Raw form data as it arrives on the server. */
export type MaskedInput = FormData | URLSearchParams | Record<string, unknown>;

type FieldName<K, C> = C extends { name: infer N extends string } ? N : K;

/** Parsed data: every mask field as a raw string, other fields untouched. */
export type MaskedData<S extends MaskSchema> = {
  [K in keyof S as FieldName<K, S[K]> & string]: string;
} & Record<string, unknown>;

export type ParseMaskedResult<Data> =
  | { success: true; data: Data; errors?: undefined }
  | { success: false; data: Data; errors: Record<string, string> };

function toObject(input: MaskedInput): Record<string, unknown> {
  if (typeof FormData !== "undefined" && input instanceof FormData) return entries(input);
  if (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams) return entries(input);
  return structuredClone(input as Record<string, unknown>);
}

function entries(source: FormData | URLSearchParams): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  source.forEach((value, key) => setPath(out, key, value));
  return out;
}

function applyMasks(fields: ResolvedField[], data: Record<string, unknown>, errors: Map<string, string>) {
  const parse = (field: ResolvedField) => {
    const raw = getPath(data, field.name);
    if (raw === undefined || raw === null || typeof raw === "object") return;
    const ctx = { from: field.from ? getPath(data, field.from) : undefined };
    const value = field.mask.parse(String(raw), ctx);
    setPath(data, field.name, toOutput(field, value, ctx));
    const error = field.mask.validate(value, ctx);
    if (error) errors.set(field.name, error);
    else errors.delete(field.name);
  };
  // Fields without `from` first, so linked fields read already-parsed values.
  fields.filter((field) => !field.from).forEach(parse);
  fields.filter((field) => field.from).forEach(parse);
}

/**
 * Parses and validates submitted data with the same schema the hook uses.
 * Pass a Standard Schema (Zod, Valibot, ArkType...) to validate the parsed result as well.
 *
 * @example
 * "use server";
 * const result = await parseMasked(checkoutMasks, formData, checkoutSchema);
 * if (!result.success) return { errors: result.errors };
 */
export function parseMasked<S extends MaskSchema>(schema: S, input: MaskedInput): ParseMaskedResult<MaskedData<S>>;
export function parseMasked<S extends MaskSchema, V extends StandardSchemaV1>(
  schema: S,
  input: MaskedInput,
  validator: V,
): Promise<ParseMaskedResult<StandardSchemaV1.InferOutput<V>>>;
export function parseMasked(
  schema: MaskSchema,
  input: MaskedInput,
  validator?: StandardSchemaV1,
): ParseMaskedResult<Record<string, unknown>> | Promise<ParseMaskedResult<unknown>> {
  const data = toObject(input);
  const errors = new Map<string, string>();
  applyMasks(resolveSchema(schema), data, errors);

  if (!validator) {
    return errors.size ? { success: false, data, errors: Object.fromEntries(errors) } : { success: true, data };
  }

  return Promise.resolve(validator["~standard"].validate(data)).then((result) => {
    for (const issue of result.issues ?? []) {
      const path = issuePath(issue);
      if (!errors.has(path)) errors.set(path, issue.message);
    }
    if (errors.size || result.issues) return { success: false, data, errors: Object.fromEntries(errors) };
    return { success: true, data: result.value };
  });
}
