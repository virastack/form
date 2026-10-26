import React, { useState, useId, useCallback, useEffect, useRef, ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { EyeIcon, EyeOffIcon } from '../icons';
import { getInputType, getButtonAriaAttributes, getInputAriaAttributes } from '../core/logic';
import type { PasswordIssue, Policy, StrengthResult } from '../strength/types';

export type ViraPasswordInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  ref?: React.Ref<HTMLInputElement>;
};

export interface UseViraPasswordOptions {
  /**
   * Initial visibility state of the password.
   * @default false
   */
  defaultVisible?: boolean;

  /**
   * Controlled visibility. Pair it with `onVisibleChange`.
   */
  visible?: boolean;

  /**
   * Called with the next visibility whenever it changes, including automatic hiding.
   */
  onVisibleChange?: (visible: boolean) => void;

  /**
   * Hide the password when its form is submitted or reset, so password managers see a password field.
   * @default true
   */
  hideOnSubmit?: boolean;

  /**
   * Hide the password when focus leaves the input and the toggle, or the browser tab is hidden.
   * @default false
   */
  hideOnBlur?: boolean;

  /**
   * `autoComplete` for the input. `false` leaves the attribute out.
   * @default "new-password" with `policy` or `matchWith`, otherwise "current-password"
   */
  autoComplete?: string | false;

  /**
   * A policy from `definePolicy()` in `@virastack/password/strength`. Enables `strength` and `issues`.
   */
  policy?: Policy;

  /**
   * Values the password must not contain, e.g. the user's email and name.
   */
  forbidden?: readonly unknown[];

  /**
   * The current value, e.g. `watch("password")`. Without it the hook follows typing in the input,
   * which misses `reset(values)` and `setValue()` from a form library.
   */
  value?: string;

  /**
   * Custom icons for show/hide states.
   */
  icons?: {
    show: ReactNode;
    hide: ReactNode;
  };

  /**
   * Whether the input is disabled.
   * If true, the toggle button will also be disabled.
   */
  disabled?: boolean;

  /**
   * Whether the input is read-only.
   * If true, the toggle button will be disabled.
   */
  readOnly?: boolean;

  /**
   * ID for the input element. If not provided, a random ID will be generated.
   */
  id?: string;

  /**
   * Props to be merged with the generated input props, e.g. `register("password")`.
   */
  inputProps?: ViraPasswordInputProps;

  /**
   * Props to be merged with the generated button props.
   */
  btnProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}

export interface UseViraPasswordResult {
  inputProps: ViraPasswordInputProps;
  btnProps: React.ButtonHTMLAttributes<HTMLButtonElement>;
  isVisible: boolean;
  /** Caps Lock is on while the input has focus. */
  capsLock: boolean;
  toggle: () => void;
  setVisible: (visible: boolean) => void;
  /** Result of the policy for the current value; `null` without a policy. */
  strength: StrengthResult | null;
  /** Spread on the element that shows the strength, so screen readers announce it. */
  strengthProps: ViraPasswordStrengthProps;
  /** Error keys for the current value. */
  issues: PasswordIssue[];
  /** A validation rule for React Hook Form: `register("password", pw.rule)`. Returns the first error key. */
  rule: ViraPasswordRule;
}

export interface ViraPasswordStrengthProps {
  id: string;
  role: 'status';
  'aria-live': 'polite';
  'aria-atomic': true;
}

export interface ViraPasswordRule {
  validate: (value: unknown) => true | PasswordIssue;
}

type Handler = (...args: unknown[]) => unknown;
type RefCleanup = ReturnType<React.RefCallback<unknown>>;

const setRef = <T>(ref: React.Ref<T> | undefined, value: T | null): RefCleanup => {
  if (typeof ref === 'function') return ref(value);
  if (ref) ref.current = value;
};

/**
 * Combines refs into one callback ref. Supports React 19 ref cleanup functions.
 */
const composeRefs = <T>(...refs: (React.Ref<T> | undefined)[]): React.RefCallback<T> => (node) => {
  const cleanups = refs.map((ref) => setRef(ref, node));
  if (!cleanups.some((cleanup) => typeof cleanup === 'function')) return;
  return () => {
    refs.forEach((ref, i) => {
      const cleanup = cleanups[i];
      if (typeof cleanup === 'function') cleanup();
      else setRef(ref, null);
    });
  };
};

/**
 * A utility to merge event handlers, class names, `aria-describedby` and refs.
 * Later props win; handlers run in order.
 */
function mergeProps<T extends object>(...args: (T | undefined)[]): T;
function mergeProps<A extends object, B extends object>(a: A | undefined, b: B | undefined): Omit<A, keyof B> & B;
function mergeProps(...args: (object | undefined)[]): object {
  const result: Record<string, unknown> = {};

  for (const props of args) {
    if (!props) continue;

    for (const [key, val] of Object.entries(props)) {
      const existing = result[key];

      if (
        key.startsWith('on') &&
        typeof val === 'function' &&
        typeof existing === 'function'
      ) {
        result[key] = (...args: unknown[]) => {
          (existing as Handler)(...args);
          (val as Handler)(...args);
        };
      } else if ((key === 'className' || key === 'aria-describedby') && typeof val === 'string' && typeof existing === 'string') {
        result[key] = [existing, val].filter(Boolean).join(' ');
      } else if (key === 'ref' && existing && val) {
        result[key] = composeRefs(existing as React.Ref<unknown>, val as React.Ref<unknown>);
      } else {
        result[key] = val;
      }
    }
  }

  return result;
}

export const useViraPassword = (options: UseViraPasswordOptions = {}): UseViraPasswordResult => {
  const {
    defaultVisible = false,
    visible: controlledVisible,
    onVisibleChange,
    hideOnSubmit = true,
    hideOnBlur = false,
    autoComplete,
    policy,
    forbidden,
    value: providedValue,
    icons,
    disabled = false,
    readOnly = false,
    id: providedId,
    inputProps: userInputProps,
    btnProps: userBtnProps,
  } = options;

  const [uncontrolledVisible, setUncontrolledVisible] = useState(defaultVisible);
  const [capsLock, setCapsLock] = useState(false);
  const userValue = userInputProps?.value;
  const tracksValue = policy !== undefined && providedValue === undefined && typeof userValue !== 'string';
  const [typed, setTyped] = useState(() => {
    const initial = userInputProps?.defaultValue;
    return typeof initial === 'string' ? initial : '';
  });
  const value = providedValue ?? (typeof userValue === 'string' ? userValue : typed);
  const isVisible = controlledVisible ?? uncontrolledVisible;
  const generatedId = useId();
  const inputId = providedId || `virapassword-input-${generatedId}`;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const setInputRef = useCallback((node: HTMLInputElement | null) => {
    inputRef.current = node;
  }, []);

  // Read from event handlers and listeners without re-subscribing on every render.
  const latest = useRef({ isVisible, controlled: controlledVisible !== undefined, onVisibleChange, policy, forbidden });
  latest.current = { isVisible, controlled: controlledVisible !== undefined, onVisibleChange, policy, forbidden };

  // Set between a pointer press on the toggle and its click.
  const pointerPress = useRef<{ start: number | null; end: number | null } | null>(null);

  const getInput = useCallback((): HTMLInputElement | null => {
    // The user may spread their own ref after ours; fall back to the id.
    return inputRef.current ?? (typeof document === 'undefined' ? null : (document.getElementById(inputId) as HTMLInputElement | null));
  }, [inputId]);

  const commit = useCallback((next: boolean) => {
    const current = latest.current;
    if (next === current.isVisible) return;
    if (!current.controlled) setUncontrolledVisible(next);
    current.onVisibleChange?.(next);
  }, []);

  const toggle = useCallback(() => {
    if (disabled || readOnly) return;
    commit(!latest.current.isVisible);
  }, [disabled, readOnly, commit]);

  const setVisible = useCallback((visible: boolean) => {
    if (disabled || readOnly) return;
    commit(visible);
  }, [disabled, readOnly, commit]);

  // Hiding is always allowed, even while disabled.
  const hide = useCallback(() => commit(false), [commit]);

  useEffect(() => {
    if (!hideOnSubmit) return;
    const isOwnForm = (event: Event) => {
      const form = getInput()?.form;
      return form != null && event.target === form;
    };
    // Capture so the field is a password field again before the browser or a form library reads it.
    const onSubmit = (event: Event) => {
      if (isOwnForm(event) && latest.current.isVisible) flushSync(hide);
    };
    const onReset = (event: Event) => {
      if (isOwnForm(event) && !event.defaultPrevented) hide();
    };
    document.addEventListener('submit', onSubmit, true);
    document.addEventListener('reset', onReset);
    return () => {
      document.removeEventListener('submit', onSubmit, true);
      document.removeEventListener('reset', onReset);
    };
  }, [hideOnSubmit, getInput, hide]);

  useEffect(() => {
    if (!tracksValue) return;
    // A reset changes the value without an input event; read it once the browser has applied it.
    const onReset = (event: Event) => {
      const input = getInput();
      if (input?.form && event.target === input.form) setTimeout(() => setTyped(input.value));
    };
    document.addEventListener('reset', onReset);
    return () => document.removeEventListener('reset', onReset);
  }, [tracksValue, getInput]);

  useEffect(() => {
    if (!hideOnBlur) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') hide();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [hideOnBlur, hide]);

  const onFieldBlur = (event: React.FocusEvent<HTMLElement>) => {
    if (!hideOnBlur || pointerPress.current) return;
    const next = event.relatedTarget;
    if (next instanceof Element && (next.id === inputId || next.getAttribute('aria-controls') === inputId)) return;
    hide();
  };

  const onCapsLock = (event: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(event.getModifierState?.('CapsLock') ?? false);
  };

  const strength = policy ? policy.evaluate(value, { forbidden }) : null;
  const issues = strength ? strength.issues : [];
  const strengthId = `${inputId}-strength`;

  // Stable, and always checks the latest policy, so it can go straight into register().
  const [rule] = useState<ViraPasswordRule>(() => ({
    validate: (input) => {
      const { policy: currentPolicy, forbidden: currentForbidden } = latest.current;
      const text = typeof input === 'string' ? input : '';
      const result = currentPolicy?.evaluate(text, { forbidden: currentForbidden });
      if (result && !result.valid) return result.issues[0];
      return true;
    },
  }));

  const showIcon = icons?.show ?? React.createElement(EyeIcon);
  const hideIcon = icons?.hide ?? React.createElement(EyeOffIcon);

  // Base props for the input
  const baseInputProps: ViraPasswordInputProps = {
    id: inputId,
    type: getInputType(isVisible),
    disabled,
    readOnly,
    ...(autoComplete === false ? {} : { autoComplete: autoComplete ?? (policy ? 'new-password' : 'current-password') }),
    spellCheck: false,
    autoCorrect: 'off',
    autoCapitalize: 'off',
    ref: setInputRef,
    ...(tracksValue ? { onChange: (event: React.ChangeEvent<HTMLInputElement>) => setTyped(event.target.value) } : {}),
    onKeyDown: onCapsLock,
    onKeyUp: onCapsLock,
    onBlur: (event) => {
      setCapsLock(false);
      onFieldBlur(event);
    },
    ...getInputAriaAttributes(undefined, policy ? strengthId : undefined),
  };

  // Base props for the button
  const baseBtnProps: React.ButtonHTMLAttributes<HTMLButtonElement> = {
    onPointerDown: () => {
      // The input still has focus here; keep its caret for when focus comes back.
      const input = getInput();
      const press = { start: input?.selectionStart ?? null, end: input?.selectionEnd ?? null };
      pointerPress.current = press;
      // A press released outside the button never clicks; forget it after the click would have run.
      window.addEventListener('pointerup', () => setTimeout(() => {
        if (pointerPress.current === press) pointerPress.current = null;
      }), { once: true });
    },
    onPointerCancel: () => {
      pointerPress.current = null;
    },
    onClick: () => {
      const press = pointerPress.current;
      pointerPress.current = null;
      if (disabled || readOnly) return;
      flushSync(toggle);
      // A mouse or touch press returns focus to the input; a keyboard press keeps it on the button.
      if (!press) return;
      const input = getInput();
      if (!input) return;
      input.focus();
      if (press.start !== null && press.end !== null) input.setSelectionRange(press.start, press.end);
    },
    onBlur: onFieldBlur,
    disabled: disabled || readOnly,
    children: isVisible ? hideIcon : showIcon,
    ...getButtonAriaAttributes(isVisible, inputId),
  };

  // Merge user props with base props
  const mergedInputProps = mergeProps(baseInputProps, userInputProps);
  const mergedBtnProps = mergeProps(baseBtnProps, userBtnProps);

  return {
    inputProps: mergedInputProps,
    btnProps: mergedBtnProps,
    isVisible,
    capsLock,
    toggle,
    setVisible,
    strength,
    strengthProps: { id: strengthId, role: 'status', 'aria-live': 'polite', 'aria-atomic': true },
    issues,
    rule,
  };
};

// Re-export the mergeProps utility if the user needs it manually
export { mergeProps, composeRefs };
