import { useEffect } from 'react';
import { useWatch, type FieldPath, type FieldValues, type UseFormReturn } from 'react-hook-form';
import { useViraPassword, type UseViraPasswordOptions, type UseViraPasswordResult } from './react/useViraPassword';
import type { Normalization, Policy } from './strength/types';

type SharedOptions = Omit<
  UseViraPasswordOptions,
  'policy' | 'forbidden' | 'matchWith' | 'value' | 'normalization' | 'id' | 'inputProps'
>;

export interface UseViraPasswordFormOptions<
  TFieldValues extends FieldValues,
  TConfirm extends FieldPath<TFieldValues> | undefined = undefined,
> extends SharedOptions {
  /** The password field. */
  name: FieldPath<TFieldValues>;
  /** A field that must repeat the password. Returned as `confirm`. */
  confirm?: TConfirm;
  /** A policy from `definePolicy()`. Enables `strength` and validation on the password field. */
  policy?: Policy;
  /** Fields the password must not be, e.g. `["email", "name"]`. Their current values are used. */
  forbidden?: readonly FieldPath<TFieldValues>[];
  /** Normalization for the confirm comparison without a policy. @default "NFKC" */
  normalization?: Normalization;
}

export interface UseViraPasswordFormResult<TConfirm> {
  /** `inputProps` already include `register()`: spread them alone on the input. */
  password: UseViraPasswordResult;
  /** The confirm field, `null` without the `confirm` option. */
  confirm: TConfirm extends string ? UseViraPasswordResult : null;
}

/**
 * `useViraPassword` bound to a React Hook Form form: registers the fields with their rules,
 * reads values with `useWatch` (so `reset()` and `setValue()` are covered), and re-checks the
 * confirm field when the password changes and the password when a `forbidden` field changes.
 */
export function useViraPasswordForm<
  TFieldValues extends FieldValues,
  TConfirm extends FieldPath<TFieldValues> | undefined = undefined,
>(
  form: UseFormReturn<TFieldValues>,
  options: UseViraPasswordFormOptions<TFieldValues, TConfirm>,
): UseViraPasswordFormResult<TConfirm> {
  const { name, confirm, policy, forbidden = [], normalization, ...shared } = options;
  // The confirm slot watches the password itself when there is no confirm field.
  const watched: unknown[] = useWatch({ control: form.control, name: [name, confirm ?? name, ...forbidden] });
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  const passwordValue = text(watched[0]);
  const confirmValue = confirm ? text(watched[1]) : '';
  const forbiddenValues = watched.slice(2);
  const normalizeWith = policy?.normalization ?? normalization;

  const password = useViraPassword({ ...shared, policy, forbidden: forbiddenValues, normalization: normalizeWith, value: passwordValue });
  const repeat = useViraPassword({ ...shared, matchWith: passwordValue, normalization: normalizeWith, value: confirmValue });

  // Re-check a field the user already left (or tried to submit) when the value it depends on changes.
  const recheck = (field: FieldPath<TFieldValues>, value: string) => {
    if (value === '') return;
    if (form.getFieldState(field).isTouched || form.formState.isSubmitted) void form.trigger(field);
  };
  // Keyed on the values only: the effects must run when a value changes, not on every render.
  useEffect(() => {
    if (confirm) recheck(confirm, confirmValue);
  }, [passwordValue]);
  const forbiddenKey = JSON.stringify(forbiddenValues);
  useEffect(() => {
    if (forbidden.length > 0) recheck(name, passwordValue);
  }, [forbiddenKey]);

  const confirmResult = confirm
    ? { ...repeat, inputProps: { ...repeat.inputProps, ...form.register(confirm, repeat.rule) } }
    : null;

  return {
    password: { ...password, inputProps: { ...password.inputProps, ...form.register(name, password.rule) } },
    confirm: confirmResult as UseViraPasswordFormResult<TConfirm>['confirm'],
  };
}
