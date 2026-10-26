/**
 * Generates the input type based on visibility.
 */
export const getInputType = (isVisible: boolean): 'text' | 'password' => {
  return isVisible ? 'text' : 'password';
};

/**
 * Generates ARIA attributes for the toggle button.
 */
export const getButtonAriaAttributes = (
  isVisible: boolean,
  inputId: string,
  label: string = 'Toggle password visibility'
) => {
  return {
    'aria-label': label,
    'aria-pressed': isVisible,
    'aria-controls': inputId,
    type: 'button' as const,
  };
};

/**
 * Generates ARIA attributes for the input field.
 */
export interface InputAriaAttributes {
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

export const getInputAriaAttributes = (
  isInvalid?: boolean,
  describedBy?: string
): InputAriaAttributes => {
  const attrs: InputAriaAttributes = {};

  if (isInvalid !== undefined) {
    attrs['aria-invalid'] = isInvalid;
  }
  
  if (describedBy) {
    attrs['aria-describedby'] = describedBy;
  }
  
  return attrs;
};
