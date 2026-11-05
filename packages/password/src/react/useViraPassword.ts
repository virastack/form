import type { FieldValues, UseFormReturn } from 'react-hook-form';
import { usePasswordField, type UseViraPasswordOptions, type UseViraPasswordResult } from './usePasswordField';
import { usePasswordForm, type ViraPasswordFields, type ViraPasswordSchema } from './usePasswordForm';

export {
  mergeProps,
  composeRefs,
  type UseViraPasswordOptions,
  type UseViraPasswordResult,
  type ViraPasswordInputProps,
  type ViraPasswordRule,
  type ViraPasswordStrengthProps,
} from './usePasswordField';
export type {
  ViraPasswordEntry,
  ViraPasswordFieldConfig,
  ViraPasswordFields,
  ViraPasswordRules,
  ViraPasswordSchema,
} from './usePasswordForm';

const isForm = (value: unknown): value is UseFormReturn<FieldValues> =>
  typeof value === 'object' && value !== null && 'register' in value && 'subscribe' in value && 'control' in value;

/**
 * The same hook bound to a React Hook Form form, like `useViraMask(form, schema)`: one entry per field,
 * `matchWith` and `forbidden` take field names. Values stay in the form; each result's `inputProps`
 * already include `register()` with the password rule.
 *
 * @example
 * const { password, confirm } = useViraPassword(form, {
 *   password: { policy, forbidden: ["email"] },
 *   confirm: { matchWith: "password" },
 * });
 * <input {...password.inputProps} />
 */
export function useViraPassword<T extends FieldValues, TContext, TTransformed, const K extends string>(
  form: UseFormReturn<T, TContext, TTransformed>,
  schema: ViraPasswordSchema<T, K>,
): ViraPasswordFields<K>;
// Last, so `ReturnType<typeof useViraPassword>` stays the single-field result.
/**
 * Password visibility, strength and confirmation for one input, without a form library.
 *
 * @example
 * const pw = useViraPassword({ policy });
 * <input {...pw.inputProps} /><button {...pw.btnProps} />
 */
export function useViraPassword(options?: UseViraPasswordOptions): UseViraPasswordResult;
export function useViraPassword(
  formOrOptions?: UseViraPasswordOptions | UseFormReturn<FieldValues>,
  schema?: ViraPasswordSchema<FieldValues>,
): UseViraPasswordResult | ViraPasswordFields<string> {
  // A component always calls it the same way, so the hooks below run in the same order on every render.
  if (isForm(formOrOptions)) return usePasswordForm(formOrOptions, schema ?? {});
  return usePasswordField(formOrOptions);
}
