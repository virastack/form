import React, { useState, useId, useCallback, ReactNode } from 'react';
import { EyeIcon, EyeOffIcon } from '../icons';
import { getInputType, getButtonAriaAttributes, getInputAriaAttributes } from '../core/logic';

export interface UseViraPasswordOptions {
  /**
   * Initial visibility state of the password.
   * @default false
   */
  defaultVisible?: boolean;
  
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
   * Props to be merged with the generated input props.
   */
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;

  /**
   * Props to be merged with the generated button props.
   */
  btnProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}

export interface UseViraPasswordResult {
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;
  btnProps: React.ButtonHTMLAttributes<HTMLButtonElement>;
  isVisible: boolean;
  toggle: () => void;
  setVisible: (visible: boolean) => void;
}

/**
 * A utility to merge event handlers and other props.
 */
type Handler = (...args: unknown[]) => unknown;

const mergeProps = <T extends object>(
  ...args: (T | undefined)[]
): T => {
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
      } else if (key === 'className' && typeof val === 'string' && typeof existing === 'string') {
        result[key] = [existing, val].filter(Boolean).join(' ');
      } else {
        result[key] = val;
      }
    }
  }

  return result as T;
};

export const useViraPassword = (options: UseViraPasswordOptions = {}): UseViraPasswordResult => {
  const {
    defaultVisible = false,
    icons,
    disabled = false,
    readOnly = false,
    id: providedId,
    inputProps: userInputProps,
    btnProps: userBtnProps,
  } = options;

  const [isVisible, setIsVisible] = useState(defaultVisible);
  const generatedId = useId();
  const inputId = providedId || `virapassword-input-${generatedId}`;

  const toggle = useCallback(() => {
    if (disabled || readOnly) return;
    setIsVisible((prev) => !prev);
  }, [disabled, readOnly]);

  const setVisible = useCallback((visible: boolean) => {
    if (disabled || readOnly) return;
    setIsVisible(visible);
  }, [disabled, readOnly]);

  const showIcon = icons?.show ?? React.createElement(EyeIcon);
  const hideIcon = icons?.hide ?? React.createElement(EyeOffIcon);

  // Base props for the input
  const baseInputProps: React.InputHTMLAttributes<HTMLInputElement> = {
    id: inputId,
    type: getInputType(isVisible),
    disabled,
    readOnly,
    ...getInputAriaAttributes(),
  };

  // Base props for the button
  const baseBtnProps: React.ButtonHTMLAttributes<HTMLButtonElement> = {
    onClick: toggle,
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
    toggle,
    setVisible,
  };
};

// Re-export the mergeProps utility if the user needs it manually
export { mergeProps };
