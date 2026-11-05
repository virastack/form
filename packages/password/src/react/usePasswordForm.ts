import { useEffect, useReducer, useRef } from 'react';
// Types only: the root entry never loads react-hook-form, so it stays an optional peer.
import type { FieldValues, Path, PathValue, RegisterOptions, UseFormReturn, Validate } from 'react-hook-form';
import { mergeProps, usePasswordField, type UseViraPasswordOptions, type UseViraPasswordResult, type ViraPasswordRule } from './usePasswordField';

export type ViraPasswordRules<T extends FieldValues> = RegisterOptions<T, Path<T>>;

/** One schema entry: the options of `useViraPassword`, with `matchWith` and `forbidden` as field names. */
export interface ViraPasswordFieldConfig<T extends FieldValues>
  extends Omit<UseViraPasswordOptions, 'value' | 'matchWith' | 'forbidden'> {
  /** Form field path, when it differs from the schema key. */
  name?: Path<T>;
  /** The field this one must repeat, e.g. `"password"` on a confirm field. */
  matchWith?: Path<T>;
  /** Fields the password must not contain, e.g. `["email", "name"]`. Their current values are used. */
  forbidden?: readonly Path<T>[];
  /** More React Hook Form rules, e.g. `{ required: "..." }`. A `validate` here runs after the password check. */
  rules?: ViraPasswordRules<T>;
}

/** A key is a form path, or any name when the entry sets `name`. */
export type ViraPasswordEntry<T extends FieldValues, K> = K extends Path<T>
  ? ViraPasswordFieldConfig<T>
  : ViraPasswordFieldConfig<T> & { name: Path<T> };

export type ViraPasswordSchema<T extends FieldValues, K extends string = string> = {
  readonly [P in K]: ViraPasswordEntry<T, P>;
};

/** One result per schema key; its `inputProps` already include `register()`. */
export type ViraPasswordFields<K extends PropertyKey> = { readonly [P in K]: UseViraPasswordResult };

interface Field<T extends FieldValues> {
  key: string;
  name: Path<T>;
  config: ViraPasswordFieldConfig<T>;
}

const text = (value: unknown) => (typeof value === 'string' ? value : '');

// The fields a field's value depends on.
const depsOf = <T extends FieldValues>(config: ViraPasswordFieldConfig<T>): Path<T>[] =>
  config.matchWith === undefined ? [...(config.forbidden ?? [])] : [config.matchWith, ...(config.forbidden ?? [])];

// `name` changed `dep`, a parent of it or a child of it.
const touches = (name: string, dep: string) => name === dep || name.startsWith(`${dep}.`) || dep.startsWith(`${name}.`);

function buildRules<T extends FieldValues>(rules: ViraPasswordRules<T> | undefined, rule: ViraPasswordRule): ViraPasswordRules<T> {
  const validate: Record<string, Validate<PathValue<T, Path<T>>, T>> = { password: rule.validate };
  if (typeof rules?.validate === 'function') validate.rule = rules.validate;
  else if (rules?.validate) Object.assign(validate, rules.validate);
  return { ...rules, validate };
}

/**
 * The React Hook Form side of `useViraPassword(form, schema)`. Values live in the form: the hook reads
 * them with `form.subscribe` (so `reset()` and `setValue()` are covered), registers each field with its
 * rule, and re-checks a field the user already left when the field it depends on changes.
 * The schema keys must stay the same between renders: each key is one field hook.
 */
export function usePasswordForm<T extends FieldValues, TContext, TTransformed, const K extends string>(
  form: UseFormReturn<T, TContext, TTransformed>,
  schema: ViraPasswordSchema<T, K>,
): ViraPasswordFields<K> {
  const formRef = useRef(form);
  formRef.current = form;
  const [, rerender] = useReducer((count: number) => count + 1, 0);

  const fields: Field<T>[] = Object.entries<ViraPasswordFieldConfig<T>>(schema).map(([key, config]) => ({
    key,
    name: config.name ?? (key as Path<T>),
    config,
  }));
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  const watched = [...new Set(fields.flatMap((field) => [field.name, ...depsOf(field.config)]))];
  const watchKey = watched.join('\0');

  // Fields to re-check once the render with the new values has updated their rules.
  const pending = useRef(new Set<Path<T>>());

  useEffect(() => {
    const unsubscribe = formRef.current.subscribe({
      name: watched,
      formState: { values: true },
      callback: ({ name }) => {
        if (name) {
          for (const field of fieldsRef.current) {
            if (depsOf(field.config).some((dep) => touches(name, dep))) pending.current.add(field.name);
          }
        }
        rerender();
      },
    });
    return unsubscribe;
    // watchKey stands for watched.
  }, [watchKey]);

  useEffect(() => {
    if (pending.current.size === 0) return;
    const names = [...pending.current];
    pending.current.clear();
    const current = formRef.current;
    for (const name of names) {
      // Re-check only a field the user already left (or tried to submit), so no error shows while typing.
      if (text(current.getValues(name)) === '') continue;
      if (current.getFieldState(name).isTouched || current.formState.isSubmitted) void current.trigger(name);
    }
  });

  const result: Record<string, UseViraPasswordResult> = {};
  for (const field of fields) {
    const { name: _name, matchWith, forbidden, rules, normalization, ...options } = field.config;
    // A confirm field compares the way its password's policy normalizes.
    const matched = matchWith === undefined ? undefined : fields.find((other) => other.name === matchWith);
    const password = usePasswordField({
      ...options,
      value: text(form.getValues(field.name)),
      matchWith: matchWith === undefined ? undefined : text(form.getValues(matchWith)),
      forbidden: forbidden?.map((path) => form.getValues(path)),
      normalization: normalization ?? matched?.config.policy?.normalization,
    });
    result[field.key] = {
      ...password,
      inputProps: mergeProps(password.inputProps, form.register(field.name, buildRules(rules, password.rule))),
    };
  }
  return result as ViraPasswordFields<K>;
}
